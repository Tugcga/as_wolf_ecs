import { STORE } from "./store";

export type Entity = u32;

export enum Type {
    I8,
    I16,
    I32,
    I64,
    U8,
    U16,
    U32,
    U64,
    F32,
    F64,
    BOOL
}

function min(a: i32, b: i32): i32 {
    if (a < b) { return a; }
    return b;
}

function type_to_string(t: Type): string {
    if (t == Type.I8) { return "i8"; }
    else if (t == Type.I16) { return "i16"; }
    else if (t == Type.I32) { return "i32"; }
    else if (t == Type.I64) { return "i64"; }
    else if (t == Type.U8) { return "u8"; }
    else if (t == Type.U16) { return "u16"; }
    else if (t == Type.U32) { return "u32"; }
    else if (t == Type.U64) { return "u64"; }
    else if (t == Type.F32) { return "f32"; }
    else if (t == Type.F64) { return "f64"; }
    else if (t == Type.BOOL) { return "bool"; }
    else { return "unknown"; }
}

export class Component {
    private id: u32;
    private arrays_i8: StaticArray<StaticArray<i8>>;
    private arrays_i16: StaticArray<StaticArray<i16>>;
    private arrays_i32: StaticArray<StaticArray<i32>>;
    private arrays_i64: StaticArray<StaticArray<i64>>;
    private arrays_u8: StaticArray<StaticArray<u8>>;
    private arrays_u16: StaticArray<StaticArray<u16>>;
    private arrays_u32: StaticArray<StaticArray<u32>>;
    private arrays_u64: StaticArray<StaticArray<u64>>;
    private arrays_f32: StaticArray<StaticArray<f32>>;
    private arrays_f64: StaticArray<StaticArray<f64>>;
    private arrays_bool: StaticArray<StaticArray<bool>>;

    private names: StaticArray<Symbol>;
    private types: StaticArray<Type>;
    private array_indices: StaticArray<u32>;  // store index of the array in the correspondence collection
    private name_to_index: Map<Symbol, i32>;

    constructor(names: Array<Symbol>, types: Array<Type>, entities_count: u32, id: u32) {
        const count: i32 = <i32>min(names.length, types.length);
        const local_names = new StaticArray<Symbol>(count);
        const local_types = new StaticArray<Type>(count);
        const local_array_indices = new StaticArray<u32>(count);
        const local_name_to_index = new Map<Symbol, i32>();

        // calculate how many arrays of the different type we shold create
        const types_count = new StaticArray<u32>(11);  // we support only 10 types of data
        // TODO: if introduce another data type, then extend this array
        for (let i = 0; i < count; i++) {
            const t = types[i];
            if (t == Type.I8) { types_count[0] += 1; }
            else if (t == Type.I16) { types_count[1] += 1; }
            else if (t == Type.I32) { types_count[2] += 1; }
            else if (t == Type.I64) { types_count[3] += 1; }
            else if (t == Type.U8) { types_count[4] += 1; }
            else if (t == Type.U16) { types_count[5] += 1; }
            else if (t == Type.U32) { types_count[6] += 1; }
            else if (t == Type.U64) { types_count[7] += 1; }
            else if (t == Type.F32) { types_count[8] += 1; }
            else if (t == Type.F64) { types_count[9] += 1; }
            else if (t == Type.BOOL) { types_count[10] += 1; }
        }

        // create new array collections
        const local_arrays_i8 = new StaticArray<StaticArray<i8>>(types_count[0]);
        const local_arrays_i16 = new StaticArray<StaticArray<i16>>(types_count[1]);
        const local_arrays_i32 = new StaticArray<StaticArray<i32>>(types_count[2]);
        const local_arrays_i64 = new StaticArray<StaticArray<i64>>(types_count[3]);
        const local_arrays_u8 = new StaticArray<StaticArray<u8>>(types_count[4]);
        const local_arrays_u16 = new StaticArray<StaticArray<u16>>(types_count[5]);
        const local_arrays_u32 = new StaticArray<StaticArray<u32>>(types_count[6]);
        const local_arrays_u64 = new StaticArray<StaticArray<u64>>(types_count[7]);
        const local_arrays_f32 = new StaticArray<StaticArray<f32>>(types_count[8]);
        const local_arrays_f64 = new StaticArray<StaticArray<f64>>(types_count[9]);
        const local_arrays_bool = new StaticArray<StaticArray<bool>>(types_count[10]);

        // reset type count array
        // we will use it for counting indices when actual create arrays
        for (let i = 0, len = types_count.length; i < len; i++) {
            types_count[i] = 0;
        }

        for (let i: i32 = 0; i < count; i++) {
            const t = types[i];
            const s = names[i];
            local_names[i] = s;
            local_types[i] = t;
            local_name_to_index[s] = i;
            if (t == Type.I8) {
                const new_array = new StaticArray<i8>(entities_count);
                local_arrays_i8[types_count[0]] = new_array;
                local_array_indices[i] = types_count[0];
                types_count[0] += 1;
            } else if (t == Type.I16) {
                const new_array = new StaticArray<i16>(entities_count);
                local_arrays_i16[types_count[1]] = new_array;
                local_array_indices[i] = types_count[1];
                types_count[1] += 1;
            } else if (t == Type.I32) {
                const new_array = new StaticArray<i32>(entities_count);
                local_arrays_i32[types_count[2]] = new_array;
                local_array_indices[i] = types_count[2];
                types_count[2] += 1;
            } else if (t == Type.I64) {
                const new_array = new StaticArray<i64>(entities_count);
                local_arrays_i64[types_count[3]] = new_array;
                local_array_indices[i] = types_count[3];
                types_count[3] += 1;
            } else if (t == Type.U8) {
                const new_array = new StaticArray<u8>(entities_count);
                local_arrays_u8[types_count[4]] = new_array;
                local_array_indices[i] = types_count[4];
                types_count[4] += 1;
            } else if (t == Type.U16) {
                const new_array = new StaticArray<u16>(entities_count);
                local_arrays_u16[types_count[5]] = new_array;
                local_array_indices[i] = types_count[5];
                types_count[5] += 1;
            } else if (t == Type.U32) {
                const new_array = new StaticArray<u32>(entities_count);
                local_arrays_u32[types_count[6]] = new_array;
                local_array_indices[i] = types_count[6];
                types_count[6] += 1;
            } else if (t == Type.U64) {
                const new_array = new StaticArray<u64>(entities_count);
                local_arrays_u64[types_count[7]] = new_array;
                local_array_indices[i] = types_count[7];
                types_count[7] += 1;
            } else if (t == Type.F32) {
                const new_array = new StaticArray<f32>(entities_count);
                local_arrays_f32[types_count[8]] = new_array;
                local_array_indices[i] = types_count[8];
                types_count[8] += 1;
            } else if (t == Type.F64) {
                const new_array = new StaticArray<f64>(entities_count);
                local_arrays_f64[types_count[9]] = new_array;
                local_array_indices[i] = types_count[9];
                types_count[9] += 1;
            } else if (t == Type.BOOL) {
                const new_array = new StaticArray<bool>(entities_count);
                local_arrays_bool[types_count[10]] = new_array;
                local_array_indices[i] = types_count[10];
                types_count[10] += 1;
            }
        }

        this.names = local_names;
        this.types = local_types;
        this.name_to_index = local_name_to_index;

        this.array_indices = local_array_indices;
        this.arrays_i8 = local_arrays_i8;
        this.arrays_i16 = local_arrays_i16;
        this.arrays_i32 = local_arrays_i32;
        this.arrays_i64 = local_arrays_i64;
        this.arrays_u8 = local_arrays_u8;
        this.arrays_u16 = local_arrays_u16;
        this.arrays_u32 = local_arrays_u32;
        this.arrays_u64 = local_arrays_u64;
        this.arrays_f32 = local_arrays_f32;
        this.arrays_f64 = local_arrays_f64;
        this.arrays_bool = local_arrays_bool;

        this.id = id;
    }

    get_id(): u32 {
        return this.id;
    }

    get_component_array_i8(name: Symbol): StaticArray<i8> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_i8[type_index];
    }

    get_component_array_i16(name: Symbol): StaticArray<i16> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_i16[type_index];
    }

    get_component_array_i32(name: Symbol): StaticArray<i32> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_i32[type_index];
    }

    get_component_array_i64(name: Symbol): StaticArray<i64> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_i64[type_index];
    }

    get_component_array_u8(name: Symbol): StaticArray<u8> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_u8[type_index];
    }

    get_component_array_u16(name: Symbol): StaticArray<u16> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_u16[type_index];
    }

    get_component_array_u32(name: Symbol): StaticArray<u32> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_u32[type_index];
    }

    get_component_array_u64(name: Symbol): StaticArray<u64> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_u64[type_index];
    }

    get_component_array_f32(name: Symbol): StaticArray<f32> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_f32[type_index];
    }

    get_component_array_f64(name: Symbol): StaticArray<f64> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_f64[type_index];
    }

    get_component_array_bool(name: Symbol): StaticArray<bool> {
        const index = this.name_to_index[name];
        const type_index = this.array_indices[index];
        return this.arrays_bool[type_index];
    }

    get_component_array_type(name: Symbol): Type {
        const index = this.name_to_index[name];
        return this.types[index];
    }

    private _get_array_length(index: i32): i32 {
        const t = this.types[index];
        const type_index = this.array_indices[index];
        if (t == Type.I8) {
            return this.arrays_i8[type_index].length;
        } else if (t == Type.I16) {
            return this.arrays_i16[type_index].length;
        } else if (t == Type.I32) {
            return this.arrays_i32[type_index].length;
        } else if (t == Type.I64) {
            return this.arrays_i64[type_index].length;
        } else if (t == Type.U8) {
            return this.arrays_u8[type_index].length;
        } else if (t == Type.U16) {
            return this.arrays_u16[type_index].length;
        } else if (t == Type.U32) {
            return this.arrays_u32[type_index].length;
        } else if (t == Type.U64) {
            return this.arrays_u64[type_index].length;
        } else if (t == Type.F32) {
            return this.arrays_f32[type_index].length;
        } else if (t == Type.F64) {
            return this.arrays_f64[type_index].length;
        } else if (t == Type.BOOL) {
            return this.arrays_bool[type_index].length;
        } else {
            return 0;
        }
    }

    private _array_store_length(index: i32): u32 {
        const t = this.types[index];

        let l = 0;
        const count = this._get_array_length(index);
        if (t == Type.I8) {
            l = count;
        } else if (t == Type.I16) {
            l = count * 2;
        } else if (t == Type.I32) {
            l = count * 4;
        } else if (t == Type.I64) {
            l = count * 8;
        } else if (t == Type.U8) {
            l = count;
        } else if (t == Type.U16) {
            l = count * 2;
        } else if (t == Type.U32) {
            l = count * 4;
        } else if (t == Type.U64) {
            l = count * 8;
        } else if (t == Type.F32) {
            l = count * 4;
        } else if (t == Type.F64) {
            l = count * 8;
        } else if (t == Type.BOOL) {
            l = count;  // boolean store as single u8
        }

        return 4  // the number of elements
             + 4  // elements type
             + l;  // actual data
    }

    private _array_to_store(index: i32): Uint8Array {
        const array_bytes_length = this._array_store_length(index);
        const to_return = new Uint8Array(4 + 4 + array_bytes_length);

        let view = new DataView(to_return.buffer);
        view.setUint32(0, STORE.T_COMPONENT_ARRAY);
        view.setUint32(4, array_bytes_length);
        let shift = 8;

        const array_elements_count = this._get_array_length(index);
        view.setInt32(shift, array_elements_count);
        shift += 4;

        const t = this.types[index];
        view.setInt32(shift, t);
        shift += 4;

        const array_index = this.array_indices[index];
        if (t == Type.I8) {
            const array_type = this.arrays_i8[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setInt8(shift, array_type[i]);
                shift += 1;
            }
        } else if (t == Type.I16) {
            const array_type = this.arrays_i16[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setInt16(shift, array_type[i]);
                shift += 2;
            }
        } else if (t == Type.I32) {
            const array_type = this.arrays_i32[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setInt32(shift, array_type[i]);
                shift += 4;
            }
        } else if (t == Type.I64) {
            const array_type = this.arrays_i64[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setInt64(shift, array_type[i]);
                shift += 8;
            }
        } else if (t == Type.U8) {
            const array_type = this.arrays_u8[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setUint8(shift, array_type[i]);
                shift += 1;
            }
        } else if (t == Type.U16) {
            const array_type = this.arrays_u16[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setUint16(shift, array_type[i]);
                shift += 2;
            }
        } else if (t == Type.U32) {
            const array_type = this.arrays_u32[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setUint32(shift, array_type[i]);
                shift += 4;
            }
        } else if (t == Type.U64) {
            const array_type = this.arrays_u64[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setUint64(shift, array_type[i]);
                shift += 8;
            }
        } else if (t == Type.F32) {
            const array_type = this.arrays_f32[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setFloat32(shift, array_type[i]);
                shift += 4;
            }
        } else if (t == Type.F64) {
            const array_type = this.arrays_f64[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setFloat64(shift, array_type[i]);
                shift += 8;
            }
        } else if (t == Type.BOOL) {
            const array_type = this.arrays_bool[array_index];
            for (let i = 0, len = array_type.length; i < len; i++) {
                view.setUint8(shift, array_type[i] ? 1 : 0);
                shift += 1;
            }
        }

        return to_return;
    }

    store_length(): u32 {
        const this_array_indices = this.array_indices;
        let arrays_length = 0;

        for (let i = 0, len = this_array_indices.length; i < len; i++) {
            arrays_length += this._array_store_length(i) + 4 + 4;
        }
        return 4  // component id
             + 4  // the number of arrays
             + arrays_length;
    }

    to_store(): Uint8Array {
        const length = this.store_length();
        const to_return = new Uint8Array(4 + 4 + length);

        let view = new DataView(to_return.buffer);
        view.setUint32(0, STORE.T_COMPONENT);
        view.setUint32(4, length);
        let shift = 8;

        view.setUint32(shift, this.id);
        shift += 4;

        const arrays_count = this.array_indices.length;
        view.setInt32(shift, arrays_count);
        shift += 4;

        for (let i = 0; i < arrays_count; i++) {
            const array_bytes = this._array_to_store(i);
            to_return.set(array_bytes, shift);
            shift += array_bytes.length;
        }

        return to_return;
    }

    from_store(view: DataView, start: u32): void {
        let shift = start;
        const section_id = view.getUint32(shift);
        shift += 4;

        const section_length = view.getUint32(shift);
        shift += 4;

        // component id
        const component_id = view.getUint32(shift);
        shift += 4;
        if (component_id != this.id) {
            return;
        }

        const arrays_count = view.getUint32(shift);
        shift += 4;

        if (arrays_count != this.array_indices.length) {
            return;
        }

        const this_types = this.types;
        const this_array_indices = this.array_indices;
        for (let i: u32 = 0; i < arrays_count; i++) {
            const array_id = view.getUint32(shift);
            shift += 4;
            if (array_id != STORE.T_COMPONENT_ARRAY) {
                continue;
            }
            const array_length = view.getUint32(shift);
            shift += 4;

            const elements_count = view.getUint32(shift);
            shift += 4;
            const elements_type = view.getUint32(shift);
            shift += 4;

            const array_index = this_array_indices[i];
            if (elements_type == this_types[i]) {
                if (elements_type == Type.I8) {
                    const array = this.arrays_i8[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getInt8(shift);
                        shift += 1;
                    }
                } else if (elements_type == Type.I16) {
                    const array = this.arrays_i16[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getInt16(shift);
                        shift += 2;
                    }
                } else if (elements_type == Type.I32) {
                    const array = this.arrays_i32[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getInt32(shift);
                        shift += 4;
                    }
                } else if (elements_type == Type.I64) {
                    const array = this.arrays_i64[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getInt64(shift);
                        shift += 8;
                    }
                } else if (elements_type == Type.U8) {
                    const array = this.arrays_u8[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getUint8(shift);
                        shift += 1;
                    }
                } else if (elements_type == Type.U16) {
                    const array = this.arrays_u16[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getUint16(shift);
                        shift += 2;
                    }
                } else if (elements_type == Type.U32) {
                    const array = this.arrays_u32[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getUint32(shift);
                        shift += 4;
                    }
                } else if (elements_type == Type.U64) {
                    const array = this.arrays_u64[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getUint64(shift);
                        shift += 8;
                    }
                } else if (elements_type == Type.F32) {
                    const array = this.arrays_f32[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getFloat32(shift);
                        shift += 4;
                    }
                } else if (elements_type == Type.F64) {
                    const array = this.arrays_f64[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getFloat64(shift);
                        shift += 8;
                    }
                } else if (elements_type == Type.BOOL) {
                    const array = this.arrays_bool[array_index];
                    for (let j: u32 = 0; j < elements_count; j++) {
                        array[j] = view.getUint8(shift) == 1 ? true : false;
                        shift += 1;
                    }
                }
            }
        }
    }

    toString(show_data: bool = false): string {
        const count = this.arrays.length;
        let str = "";
        for (let i = 0; i < count; i++) {
            str += (str.length == 0 ? "": ", ") + 
                   this.names[i].toString() + ":" + 
                   type_to_string(this.types[i]) +  
                   (show_data ? ":" + "[array]" : "");
        }
        return `id=${this.id}, data={${str}}`;
    }
}