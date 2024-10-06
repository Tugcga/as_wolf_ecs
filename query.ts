import { Archetype } from "./sparse_set";
import { ECS } from "./ecs";
import { Component, Entity } from "./component";

export enum Modificator {
    ALL,
    NOT,
    ANY
}

class QueryMask {
    private mod: Modificator;
    private mask: Array<QueryMask>;
    private dt: Uint32Array;

    constructor(in_mod: Modificator, in_mask: Array<QueryMask>, in_dt: Uint32Array) {
        this.mod = in_mod;
        this.mask = in_mask;
        this.dt = in_dt;
    }

    get_mod(): Modificator {
        return this.mod;
    }

    set_dt(new_dt: Uint32Array): void {
        this.dt = new_dt;
    }

    get_dt_length(): i32 {
        return this.dt.length;
    }

    get_dt_value(index: i32): u32 {
        return this.dt[index];
    }

    get_dt(): Uint32Array {
        return this.dt;
    }

    get_masks_length(): i32 {
        return this.mask.length;
    }

    get_masks_value(index: i32): QueryMask {
        return this.mask[index];
    }

    toString(): string {
        return `QueryMask{${this.mod}: [${this.mask}][${this.dt}]}`;
    }
}

export class RawQuery {
    private mod: Modificator;
    private queries: Array<RawQuery>;
    private components: Array<Component>;

    constructor(in_mod: Modificator, in_queries: Array<RawQuery>, in_components: Array<Component>) {
        this.mod = in_mod;

        this.queries = in_queries;
        this.components = in_components;
    }

    get_mod(): Modificator {
        return this.mod;
    }

    get_queries(): Array<RawQuery> {
        return this.queries;
    }

    get_components(): Array<Component> {
        return this.components;
    }

    toString(): string {
        return `RawQuery{${this.mod}: [${this.queries}][${this.components}]}`;
    }
}

export function All(components: Array<Component>): RawQuery {
    return new RawQuery(Modificator.ALL, [], components);
}

export function Any(components: Array<Component>): RawQuery {
    return new RawQuery(Modificator.ANY, [], components);
}

export function Not(component: Component): RawQuery {
    return new RawQuery(Modificator.NOT, [new RawQuery(Modificator.ALL, [], [component])], []);
}

function max_nums(nums: Array<i32>): i32 {
    let m = -1;
    for (let i = 0, len = nums.length; i < len; i++) {
        const v = nums[i];
        if (v > m) {
            m = v;
        }
    }
    return m;
}

function create_query(raw: RawQuery): QueryMask {
    const raw_queries = raw.get_queries();

    if (raw.get_mod() == Modificator.NOT) {
        return new QueryMask(raw.get_mod(), [create_query(raw_queries[0])], new Uint32Array(0));
    }
    const nums: Array<i32> = [];
    const ret: Array<QueryMask> = [new QueryMask(raw.get_mod(), [], new Uint32Array(0))];
    for (let i = 0, len = raw_queries.length; i < len; i++) {
        const ri = raw_queries[i];
        ret.push(create_query(ri));
    }
    const raw_components = raw.get_components();
    for (let i = 0, len = raw_components.length; i < len; i++) {
        const ci = raw_components[i];
        nums.push(ci.get_id());
    }

    const ret_length = <i32>(Math.ceil(<f32>(max_nums(nums) + 1) / 32));
    ret[0].set_dt(new Uint32Array(ret_length));
    for (let i = 0, len = nums.length; i < len; i++) {
        const iv = nums[i];
        ret[0].get_dt()[<i32>Math.floor(iv / 32)] |= 1 << iv % 32;
    }

    return new QueryMask(raw.get_mod(), ret, new Uint32Array(0));
}

export class Query {
    private archetypes: Array<Archetype>;
    private ecs: ECS;
    private mask: QueryMask;
    private update_entities_array: bool;
    private entities_array: Array<Entity>;

    private iter_arch_ptr: i32;
    private iter_ent_ptr: i32;
    private iter_arch_count: i32;
    private iter_current_arch: Archetype | null;
    private iter_current_ents: Array<Entity> | null;
    private iter_start: bool;

    constructor(ecs: ECS, raw: RawQuery, track_entities: bool) {
        this.archetypes = new Array<Archetype>();
        this.ecs = ecs;
        this.update_entities_array = track_entities;
        this.entities_array = new Array<Entity>();

        this.mask = create_query(raw);

        this.iter_arch_ptr = 0;
        this.iter_ent_ptr = 0;
        this.iter_arch_count = 0;
        this.iter_current_arch = null;
        this.iter_current_ents = null;
        this.iter_start = true;
    }

    iterator_start(): void {
        // make empty values
        this.iter_arch_ptr = 0;  // index of the current archetype
        this.iter_ent_ptr = 0;  // index of the current entity to output
        this.iter_arch_count = 0;  // the total number of archetypes
        this.iter_current_arch = null;  // pointer to the current archetype
        this.iter_current_ents = null;  // pointer to the array with current entities
        this.iter_start = true;  // activate when we should start the iteration
    }

    iterator_has(): bool {
        // ..._has method shold switch to the value that should be returnd by ..._get  method
        // if it's possible, then return true, otherwise - false
        if (this.iter_start) {
            // for the start we should find the first non-null value
            const this_archetypes = this.archetypes;
            const archetypes_count = this_archetypes.length;
            if (archetypes_count > 0) {
                for (let i = 0; i < archetypes_count; i++) {
                    let arch = this_archetypes[i];
                    const arch_entities = arch.get_entities();
                    if (arch_entities.length > 0) {
                        this.iter_arch_ptr = i;
                        this.iter_ent_ptr = 0;
                        this.iter_arch_count = archetypes_count;
                        this.iter_current_arch = arch;
                        this.iter_current_ents = arch_entities;

                        this.iter_start = false;
                        // we find the valid archetype for the start of the iteration
                        return true;
                    }
                }
                // no non-empty archetypes
                return false;
            } else {
                // there are no archetypes
                return false;
            }
        } else {
            // we shouwld switch pointers to the next entity
            const this_iter_current_arch = this.iter_current_arch;
            const this_iter_current_ents = this.iter_current_ents;
            if (this_iter_current_arch && this_iter_current_ents) {
                const arch_entities_count = this_iter_current_ents.length;
                if (this.iter_ent_ptr + 1 == arch_entities_count) {
                    // switch to the next archetype
                    const archs_count = this.iter_arch_count;
                    for (let i = this.iter_arch_ptr + 1; i < archs_count; i++) {
                        const arch = this.archetypes[i];
                        const arch_entities = arch.get_entities();
                        if (arch_entities.length > 0) {
                            this.iter_arch_ptr = i;
                            this.iter_ent_ptr = 0;
                            this.iter_current_arch = arch;
                            this.iter_current_ents = arch_entities;

                            return true;
                        }
                    }
                    // fail to find next non-empty archetype
                    return false;
                } else {
                    // use the next entity in the current archetype
                    this.iter_ent_ptr += 1;

                    return true;
                }
            } else {
                // pointers to the null,nothing to do
                return false;
            }
        }
    }

    iterator_get(): Entity {
        const this_iter_current_ents = this.iter_current_ents;
        if (this_iter_current_ents) {
            return this_iter_current_ents[this.iter_ent_ptr];
        } else {
            assert(false, "Iterator fails");
            return 0;
        }
    }

    for_each(callback: (id: Entity, ecs: ECS) => void): void {
        const this_archetypes = this.archetypes;

        for (let i = 0, len = this_archetypes.length; i < len; i++) {
            const archetype = this_archetypes[i];
            const ent = archetype.get_entities();
            for (let j = ent.length; j > 0; j--) {
                callback(ent[j - 1], this.ecs);
            }
        }

        this.ecs.destroy_pending();
        this.ecs.update_pending();
    }

    private static partial(target: Uint32Array, mask: QueryMask): bool {
        if (mask.get_mod() == Modificator.ALL) {
            for (let i = 0, len = mask.get_dt_length(); i < len; i++) {
                if ((target[i] & mask.get_dt_value(i)) < mask.get_dt_value(i)) {
                    return false;
                }
            }
            return true;
        }

        for (let i = 0, len = mask.get_dt_length(); i < len; i++) {
            if ((target[i] & mask.get_dt_value(i)) > 0) {
                return true;
            }
        }

        return false;
    }

    static match(target: Uint32Array, mask: QueryMask): bool {
        if (mask.get_masks_length() == 0) {
            return Query.partial(target, mask);
        }

        if (mask.get_mod() == Modificator.NOT) {
            return !Query.match(target, mask.get_masks_value(0));
        }

        if (mask.get_mod() === Modificator.ALL) {
            for (let i = 0, len = mask.get_masks_length(); i < len; i++) {
                const q = mask.get_masks_value(i);
                if (!Query.match(target, q)) {
                    return false;
                }
            }
            return true;
        }

        for (let i = 0, len = mask.get_masks_length(); i < len; i++) {
            const q = mask.get_masks_value(i);
            if (Query.match(target, q)) {
                return true;
            }
        }

        return false;
    }

    get_entities(): Array<Entity> {
        const entities_array = this.entities_array;
        if (this.update_entities_array) {
            entities_array.length = 0;

            const archetypes = this.archetypes;

            for (let i = 0, len = archetypes.length; i < len; i++) {
                const archetype = archetypes[i];
                const entities = archetype.get_entities();
                for (let j = entities.length; j > 0; j--) {
                    entities_array.push(entities[j - 1]);
                }
            }
        }

        this.update_entities_array = false;

        return this.entities_array;
    }

    mark_update_entities(): void {
        this.update_entities_array = true;
    }

    add_archetype(arch: Archetype): void {
        this.archetypes.push(arch);
    }

    get_archetypes(): Array<Archetype> {
        return this.archetypes;
    }

    get_mask(): QueryMask {
        return this.mask;
    }

    get_ecs(): ECS {
        return this.ecs;
    }

    toString(): string {
        return `Query{}`;
    }
}