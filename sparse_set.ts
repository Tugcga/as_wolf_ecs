import { Entity } from "./component";

export class SparseSet {
    private packed: Array<u32>;
    private sparse: Array<u32>;

    constructor() {
        this.packed = new Array<u32>(0);
        this.sparse = new Array<u32>(0);
    }

    has(x: u32): bool {
        return x < <u32>this.sparse.length && this.sparse[x] < <u32>this.packed.length && this.packed[this.sparse[x]] === x;
    }

    add(x: u32): void {
        if (!this.has(x)) {
            this.sparse[x] = this.packed.length;  // automaticaly extend the array by 0-values
            this.packed.push(x);
        }
    }

    remove(x: u32): void {
        if (this.has(x)) {
            const last = this.packed.pop();
            if (x != last) {
                this.sparse[last] = this.sparse[x];
                this.packed[this.sparse[x]] = last;
            }
        }
    }

    clear(): void {
        this.packed.length = 0;
        this.sparse.length = 0;
    }

    get_packed(): Array<u32> {
        return this.packed;
    }

    packed_value(index: i32): u32 {
        return this.packed[index];
    }

    packed_length(): i32 {
        return this.packed.length;
    }

    packed_pop(): u32 {
        return this.packed.pop();
    }

    reset_packed(create_new: bool): void {
        if (create_new) {
            this.packed = new Array<u32>(0);
        } else {
            this.packed.length = 0;
        }
        
    }

    toString(): string {
        return `SparseSet{packed: [${this.packed}], sparse: [${this.sparse}]}`;
    }
}

export class Archetype {
    private sset: SparseSet;
    private entities: Array<Entity>;
    private mask: Uint32Array;
    private change: Array<Archetype | null>;

    constructor(mask: Uint32Array) {
        this.mask = mask;

        const sset = new SparseSet();
        const local_entities = sset.get_packed();

        this.sset = sset;
        this.entities = local_entities;
        this.change = new Array<Archetype | null>();
    }

    get_mask(): Uint32Array {
        return this.mask;
    }

    mask_string(): string {
        return this.mask.toString();
    }

    get_entities(): Array<Entity> {
        return this.entities;
    }

    sset_remove(value: u32): void {
        this.sset.remove(value);
    }

    sset_add(value: u32): void {
        this.sset.add(value);
    }

    get_change_length(): i32 {
        return this.change.length;
    }

    get_change_value(index: i32): Archetype | null {
        return this.change[index];
    }

    set_change_value(index: u32, value: Archetype): void {
        this.change[index] = value;
    }

    set_mask(in_mask: Uint32Array): void {
        this.mask = in_mask;
    }

    has(x: u32): bool {
        return this.sset.has(x);
    }

    toString(): string {
        return `Archetype{sset: ${this.sset}}, entities: [${this.entities}], mask: [${this.mask}], change count=${this.change.length}}`;
    }
}