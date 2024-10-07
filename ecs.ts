import { Entity, Component, Type } from "./component";
import { SparseSet, Archetype } from "./sparse_set";
import { Query, RawQuery, Modificator } from "./query";
import { System } from "./system";
import { STORE } from "./store";

function map_to_string(m: Map<string, Archetype>): string {
    let s = "";
    const keys = m.keys();
    for (let i = 0, len = keys.length; i < len; i++) {
        const k = keys[i];
        const v = m.get(k);
        s += (i == 0 ? "" : ", ") + k.toString() + "->" + v.toString();
    }
    return s;
}

export class ECS {
    private readonly MAX_ENTITIES: u32;
    private readonly DEFAULT_DEFER: bool;
    private component_id: u32;
    private entity_id: u32;
    private rm: SparseSet;
    private empty: Archetype;
    private arch: Map<string, Archetype>;
    private ent: Array<Archetype>;
    private to_destroy: SparseSet;
    private to_update: SparseSet;
    private update_to: Array<Archetype>;

    private queries: Array<Query>;
    private systems: Array<System>;
    private components: Array<Component>;

    constructor(max: u32 = 10000, defer: bool = false) {
        this.MAX_ENTITIES = max;
        this.DEFAULT_DEFER = defer;
        this.component_id = 0;
        this.entity_id = 0;

        this.rm = new SparseSet();
        this.empty = new Archetype(new Uint32Array(0));
        this.arch = new Map<string, Archetype>();
        this.ent = new Array<Archetype>();
        this.to_destroy = new SparseSet();
        this.to_update = new SparseSet();
        this.update_to = new Array<Archetype>();
        this.queries = new Array<Query>();
        this.systems = new Array<System>();
        this.components = new Array<Component>();
    }

    //-------private methods-------
    //-----------------------------
    private _valid_id(id: Entity): bool {
        return !(this.rm.has(id) || this.entity_id <= id);
    }

    private _get_arch(mask: Uint32Array): Archetype {
        const this_arch = this.arch;
        if (!this_arch.has(mask.toString())) {
            const arch = new Archetype(mask.slice());
            this_arch.set(mask.toString(), arch);
            const this_queries = this.queries;
            for (let i = 0, len = this_queries.length; i < len; i++) {
                const q = this_queries[i];
                if(Query.match(mask, q.get_mask())) {
                    q.add_archetype(arch);
                }
            }
        }
        return this_arch.get(mask.toString());
    }

    private _has_component(mask: Uint32Array, i: u32): bool {
        return <bool>(mask[~~(i / 32)] & (1 << i % 32));
    }

    private _arch_change(arch: Archetype, i: u32): Archetype | null {
        let make_change = false;
        if (<u32>arch.get_change_length() <= i) {
            make_change = true;
        }

        if (!make_change) {
            const arch_i = arch.get_change_value(i);
            if (!arch_i) {
                make_change = true;
            }
        }
        
        if (make_change) {
            arch.get_mask()[~~(i / 32)] ^= 1 << i % 32;
            arch.set_change_value(i, this._get_arch(arch.get_mask()));
            arch.get_mask()[~~(i / 32)] ^= 1 << i % 32;
        }
        return arch.get_change_value(i);
    }

    private _create_entity(id: u32): void {
        const this_empty = this.empty;

        this.ent[id] = this_empty;
        this.update_to[id] = this_empty;

        this_empty.sset_add(id);
    }

    private _update_queries(ent_mask: Uint32Array): void {
        for (let i = 0, len = this.queries.length; i < len; i++) {
            const query = this.queries[i];
            if (Query.match(ent_mask, query.get_mask())) {
                query.mark_update_entities();
            }
        }
    }

    private _store_length(): u32 {
        // contains entities and components section
        return (4 + 4 + this._store_entities_length()) + 
               (4 + 4 + this._store_components_length());
    }

    private _store_entities_length(): u32 {
        return 4  // the number of entities
             + 4 + 4 + this._store_removed_entities_length()
             + 4 + 4 + this._store_active_entitites_length();
    }

    private _store_removed_entities_length(): u32 {
        const removed_sset = this.rm;
        const removed_array = removed_sset.get_packed();
        return 4 * removed_array.length;
    }

    private _store_active_entitites_length(): u32 {
        let to_return: u32 = 0;
        const removed_sset = this.rm;

        for (let i: u32 = 0, len = this.entity_id; i < len; i++) {
            if (!removed_sset.has(i)) {
                to_return += 4 + 4 + this._store_entity_length(i);
            }
        }
        return to_return;
    }

    private _store_entity_length(entity: u32): u32 {
        const ent_arch = this.ent[entity];
        const ent_arch_mask = ent_arch.get_mask();
        return 4  // entity id
             + ent_arch_mask.length * 4;  // each value of the mask is u32
    }

    private _store_components_length(): u32 {
        let to_return = 0;
        const this_components = this.components;
        for (let i = 0, len = this_components.length; i < len; i++) {
            const component = this_components[i];
            to_return += 4 + 4 + component.store_length();
        }
        return to_return;
    }

    private _destroy_all(): void {
        for (let i: u32 = 0, len = this.entity_id; i < len; i++) {
            this.destroy_entity(i);
        }

        this.rm.clear();
        this.entity_id = 0;
    }


    //--------public methond-------
    //-----------------------------
    get_max_entities(): u32 {
        return this.MAX_ENTITIES;
    }

    get_entity_archetype(entity: Entity): Archetype {
        return this.ent[entity];
    }

    define_component(names: Array<Symbol>, types: Array<Type>): Component {
        assert(this.entity_id == 0, "Cannot define component after entity creation");

        const component = new Component(names, types, this.MAX_ENTITIES, this.component_id);
        // store component in the array
        this.components.push(component);
        this.component_id += 1;
        return component;
    }

    get_component(component_id: i32): Component {
        return this.components[component_id];
    }

    create_query(raw_queries: Array<RawQuery>): Query {
        const this_arch = this.arch;

        const query = new Query(this, new RawQuery(Modificator.ALL, raw_queries, []));
        const arch_keys = this_arch.keys();
        const arch_keys_count = arch_keys.length;
        for (let i = 0; i < arch_keys_count; i++) {
            const k = arch_keys[i];
            const v = this_arch.get(k);

            if (Query.match(v.get_mask(), query.get_mask())) {
                query.add_archetype(v);
            }
        }

        this.queries.push(query);

        return query;
    }

    register_system(in_system: System): void {
        this.systems.push(in_system);
    }

    get_system(index: i32): System {
        return this.systems[index];
    }

    create_entity(): Entity {
        const this_rm = this.rm;
        const rm_length = this_rm.packed_length();
        if (rm_length > 0) {
            const id = this_rm.packed_pop();
            this._create_entity(id);
            return id;
        } else {
            if (this.entity_id == 0) {
                const mask_length: i32 = <i32>Math.ceil(<f32>this.component_id / 32.0);
                const this_empty = this.empty;
                const this_arch = this.arch;

                this_empty.set_mask(new Uint32Array(mask_length));

                this_arch.set(this_empty.mask_string(), this_empty);
            }
            assert(this.entity_id != this.MAX_ENTITIES, "Maximum entity limit reached");

            this._create_entity(this.entity_id);
            return this.entity_id++;
        }
    }

    destroy_entity(id: Entity, defer: bool = this.DEFAULT_DEFER): void {
        const this_to_destroy = this.to_destroy;

        if (defer) {
            this_to_destroy.add(id);
        } else {
            const this_ent = this.ent;
            const this_rm = this.rm;

            const ent_arch = this_ent[id];

            ent_arch.sset_remove(id);
            this_to_destroy.remove(id);
            this_rm.add(id);
        }
    }

    destroy_pending(): void {
        const this_to_destroy = this.to_destroy;
        while (this_to_destroy.packed_length() > 0) {
            this.destroy_entity(this_to_destroy.packed_value(0), false)
        }

        this_to_destroy.reset_packed(false);
    }

    add_component(id: Entity, cmp: Component, defer: bool = this.DEFAULT_DEFER): void {
        assert(this._valid_id(id), "Invalid entity id");

        const i: u32 = cmp.get_id();
        if (defer) {
            const this_to_update = this.to_update;
            this_to_update.add(id);
        } else {
            const this_ent = this.ent;
            let this_ent_arch = this_ent[id];
            const ent_mask = this_ent_arch.get_mask();

            if (!this._has_component(ent_mask, i)) {
                this_ent_arch.sset_remove(id);
                const arch_change = this._arch_change(this_ent_arch, i);
                if (arch_change) {
                    this_ent[id] = arch_change;
                    this_ent_arch = this_ent[id];
                }
                
                this_ent_arch.sset_add(id);
            }
        }

        const this_update_to = this.update_to;
        if (!this._has_component(this_update_to[id].get_mask(), i)) {
            const arch_change = this._arch_change(this_update_to[id], i);
            if (arch_change) {
                this_update_to[id] = arch_change;
            }
        }
    }

    remove_component(id: Entity, cmp: Component, defer: bool = this.DEFAULT_DEFER): void {
        assert(this._valid_id(id), "Invalid entity id");
        
        const i: u32 = cmp.get_id();
        if (defer) {
            const this_to_update = this.to_update;
            this_to_update.add(id);
        } else {
            const this_ent = this.ent;
            let this_ent_arch = this_ent[id];
            const ent_mask = this_ent_arch.get_mask();

            if (this._has_component(ent_mask, i)) {
                this_ent[id].sset_remove(id);
                const arch_change = this._arch_change(this_ent_arch, i);
                if (arch_change) {
                    this_ent[id] = arch_change;
                    this_ent_arch = arch_change;
                }
                this_ent_arch.sset_add(id);
            }
        }

        const this_update_to = this.update_to;
        if (this._has_component(this_update_to[id].get_mask(), i)) {
            const arch_change = this._arch_change(this_update_to[id], i);
            if (arch_change) {
                this_update_to[id] = arch_change
            }
        }
    }

    update_pending(): void {
        const this_to_update = this.to_update;
        const this_update_to = this.update_to;
        const this_ent = this.ent;

        const arr = this_to_update.get_packed();
        for (let i = 0, len = arr.length; i < len; i++) {
            const id = arr[i];

            if (this._valid_id(id)) {
                this_ent[id].sset_remove(id);
                this_ent[id] = this_update_to[id];
                this_ent[id].sset_add(id);
            }
        }

        this_to_update.reset_packed(true);
    }

    update(dt: f32 = 0.0): void {
        const this_systems = this.systems;
        for (let i = 0, len = this_systems.length; i < len; i++) {
            const system = this_systems[i];
            system.update(dt);
        }

        this.destroy_pending();
        this.update_pending();
    }

    to_store(): Uint8Array {
        const bytes_length = this._store_length();

        const to_return = new Uint8Array(4 + 4 + bytes_length);
        const view = new DataView(to_return.buffer);

        // we should store entities, and components in the following format:
        // 4 bytes for header of the ecs store
        // 4 bytes for the total length of the ecs store (does not include the pair of the previous 4 bytes)
        //      |....|....|.....
        //                |--> this length
        // 4 bytes for entities section header
        // 4 bytes for the total length of the entities section
        //      4 bytes for the number of entities (active and removed)
        //      4 bytes for the section of removed entities
        //      4 bytes for the length of this section
        //          array with valued of removed entities
        //      4 bytes for the section of active entities
        //      4 bytes for the length of this section
        //          then for each active entity:
        //          entity header
        //          entity data length
        //              entity id
        //              Uint32Array with flags for assigned components
        // 4 bytes for components section header
        // 4 bytes for the length of the component section
        //      for each component
        //      4 bytes for component header
        //      4 bytes for component section length
        //          component id
        //          number of arrays
        //          for each array
        //              4 bytes array section
        //              4 bytes section length
        //                  the number of elements
        //                  elements type
        //                  actual values

        view.setUint32(0, STORE.T_ECS);
        view.setUint32(4, bytes_length);
        let shift = 8;

        // start entities section
        view.setUint32(shift, STORE.T_ENTITIES);
        shift += 4;
        const entities_bytes = this._store_entities_length();
        view.setUint32(shift, entities_bytes);
        shift += 4;

        // the total number of entitites
        view.setUint32(shift, this.entity_id);
        shift += 4;

        // start section of removed entities
        view.setUint32(shift, STORE.T_REMOVED_ENTITY);
        shift += 4;
        const removed_length = this._store_removed_entities_length();
        view.setUint32(shift, removed_length);
        shift += 4;
        // write indices of removed entitites
        const removed_sset = this.rm;
        const removed_array = removed_sset.get_packed();
        for (let i = 0, len = removed_array.length; i < len; i++) {
            view.setUint32(shift, removed_array[i]);
            shift += 4;
        }

        // start section of active entitites
        view.setUint32(shift, STORE.T_ACTIVE_ENTITY);
        shift += 4;
        const active_length = this._store_active_entitites_length();
        view.setUint32(shift, active_length);
        shift += 4;
        // iterate throw all entitites
        for (let i: u32 = 0, len = this.entity_id; i < len; i++) {
            // check is thie entitiy is active
            if (!removed_sset.has(i)) {
                // start entity section
                view.setUint32(shift, STORE.T_ENTITY);
                shift += 4;
                const entity_length = this._store_entity_length(i);
                view.setUint32(shift, entity_length);
                shift += 4;

                // write entity id
                view.setUint32(shift, i);
                shift += 4;
                // next Uint32 array with mask of the assigned components
                const ent_arch = this.ent[i];
                const ent_arch_mask = ent_arch.get_mask();
                for (let j = 0, j_len = ent_arch_mask.length; j < j_len; j++) {
                    view.setUint32(shift, ent_arch_mask[j]);
                    shift += 4;
                }
            }
        }

        // next components
        view.setUint32(shift, STORE.T_COMPONENTS);
        shift += 4;

        const components_length = this._store_components_length();
        view.setUint32(shift, components_length);
        shift += 4;

        const this_components = this.components;
        for (let i = 0, len = this_components.length; i < len; i++) {
            const component = this_components[i];
            const component_length = component.store_length();
            const component_bytes = component.to_store();
            to_return.set(component_bytes, shift);
            shift += component_length + 4 + 4;
        }

        return to_return;
    }

    from_store_bytes(bytes: Uint8Array): void {
        const view = new DataView(bytes.buffer);
        this.from_store(view, 0);
    }

    from_store(view: DataView, start: u32): void {
        // read the header
        let shift = start;
        const section_id = view.getUint32(shift);
        if (section_id != STORE.T_ECS) {
            return;
        }

        shift += 4;
        const bytes_length = view.getUint32(shift);

        // read next section id
        shift += 4;
        const entities_id = view.getUint32(shift);
        if (entities_id != STORE.T_ENTITIES) {
            return;
        }
        shift += 4;
        const entities_length = view.getUint32(shift);

        // before read entities seciotn, destroy all entities
        this._destroy_all();
        // create all entities
        // read the number of entities from bytes
        shift += 4;
        const entities_count = view.getUint32(shift);
        for (let i: u32 = 0; i < entities_count; i++) {
            this.create_entity();
        }

        // read removed entities section
        shift += 4;
        const removed_entities_id = view.getUint32(shift);
        if (removed_entities_id != STORE.T_REMOVED_ENTITY) {
            return;
        }
        shift += 4;
        const removed_entities_length = view.getUint32(shift);
        // we store all removed entitiea by u32, so the number of removed is length / 4
        for (let i: u32 = 0, len = removed_entities_length / 4; i < len; i++) {
            shift += 4;
            const ent = view.getUint32(shift);
            this.destroy_entity(ent);
        }

        // section of active entities
        shift += 4;
        const active_entities_id = view.getUint32(shift);
        if (active_entities_id != STORE.T_ACTIVE_ENTITY) {
            return;
        }
        shift += 4;
        const active_entities_length = view.getUint32(shift);
        // read data until we read these number of bytes
        shift += 4;
        let read_bytes: u32 = 0;
        while (read_bytes < active_entities_length) {
            // read entity section id
            const entity_id = view.getUint32(shift + read_bytes);
            read_bytes += 4
            // and bytes length
            const entity_length = view.getUint32(shift + read_bytes);
            read_bytes += 4;

            // actual entity id
            const ent = view.getUint32(shift + read_bytes);
            read_bytes += 4;
            // and next array for mask
            const mask_length = (entity_length - 4) / 4;
            for (let i: u32 = 0; i < mask_length; i++) {
                const mask_value = view.getUint32(shift + read_bytes);
                read_bytes += 4;
                // split mask value to bits
                for (let bit: u8 = 0; bit < 32; bit++) {
                    const v = mask_value & (1 << bit);
                    if (v > 0) {
                        // add component bit + 32 * i
                        const component_index = <u32>bit + 32 * i;
                        this.add_component(ent, this.components[component_index]);
                    }
                }
            }
        }
        shift += read_bytes;

        // next, components section
        const components_id = view.getUint32(shift);
        if (components_id != STORE.T_COMPONENTS) {
            return;
        }
        shift += 4;
        const components_length = view.getUint32(shift);
        shift += 4;  // <- points to the start of the component section

        // fill data for all components
        const this_components = this.components;
        for (let i = 0, len = this_components.length; i < len; i++) {
            const component = this_components[i];

            const component_id = view.getUint32(shift);
            shift += 4;
            if (component_id != STORE.T_COMPONENT) {
                continue;
            }
            const component_length = view.getUint32(shift);
            shift += 4;
            component.from_store(view, shift - 8);

            shift += component_length;
        }
    }

    toString(): string {
        return `ECS:
    MAX_ENTITIES=${this.MAX_ENTITIES}, 
    DEFAULT_DEFER=${this.DEFAULT_DEFER}, 
    component_id=${this.component_id}, 
    entity_id=${this.entity_id}, 
    arch={${map_to_string(this.arch)}}, 
    ent=[${this.ent}], 
    rm=${this.rm},
    empty=${this.empty},
    to_destroy=${this.to_destroy},
    to_update=${this.to_update},
    update_to=[${this.update_to}],
    queries=[${this.queries}]`;
    }
}