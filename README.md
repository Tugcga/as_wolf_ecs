![](https://github.com/user-attachments/assets/3ab1610b-c878-40a1-bf5e-0a75fbc3173d)

## What is it?

This is a port of the [Wolf ECS](https://github.com/EnderShadow8/wolf-ecs) system into [AssemblyScript](https://github.com/AssemblyScript/assemblyscript). This repository should be used as part of another AssemblyScript project. The architecture uses the SoA approach to store data for components. In this case, for each data field of the component, the array with values for all entities is created. This architecture uses more memory, but it is more performance compared to the object-based architecture.

## How to use

Make the necessary imports
```typescript
import { ECS } from "./as_wolf_ecs/ecs";
import { Component, Type, Entity } from "./as_wolf_ecs/component";
import { Archetype } from "./as_wolf_ecs/sparse_set";
import { All, Not, Any, Query } from "./as_wolf_ecs/query";
import { System } from "./as_wolf_ecs/system";
```

Create ecs instance. The parameter defines the maximum number of entities

```typescript
const ecs = new ECS(100000);
```

Define the components. For each component, it's necessary to define two arrays
* Names of the fields. Each name is a symbol. These names should be unique within a component.
* Types of named fields. ECS supports 11 data types: I8, I16, I32, I64, U8, U16, U32, U64, F32, F64, BOOL
```typescript
const component = ecs.define_component([Symbol.for("x"), Symbol.for("y")], [Type.F32, Type.F32]);
```

It's possible to get the actual array of component data by using the field name
```typescript
const array_x = component.get_component_array_f32(Symbol.for("x"));
```

Create entities
```typescript
const ent = ecs.create_entity();
```

By default, entity does not contain a component. So, to add it
```typescript
ecs.add_component(ent, component);
```

To define the actual value of the component to the entity
```typescript
array_x[ent] = 3.14;
```

To remove the component
```typescript
ecs.remove_component(ent, component);
```

Destroy entity
```typescript
ecs.destroy_entity(ent);
```

Query used to iterate over entities with a given set of components. The parameter of the query is a list of components with modifiers ```All, Any, Not```
```typescript
const query = ecs.create_query([All([component])]);
```

The modificator ```All([c0, c1, c2])``` means that the entity should contain all components ```c0, c1``` and ```c2```. The modificator ```Not(c3)``` means that the entity should not contain the component ```c3```. Modificator ```Any([c4, c5])``` means that if entity contains either ```c4``` or ```c5``` then it will be matched by the query. All these modificators can be combined
```typescript
const m = [All(c0, c1, c2), Not(c3), Any([c4, c5])];
```

It's possible to use simple ForEach iterators by using anonimus function.
```typescript
quer.for_each((id: Entity, ecs: ECS) => {
    // make something with entity
})
```

But it is better to create the system and run it
```typescript
class LogSystem extends System {
    constructor(in_query: Query) {
        super(in_query);
    }
    
    update(dt: f32): void {
        // use this.system_query to get entities that match the query
    }
}
```

To get matching entities, it's possible to use query iterators
```typescript
update(dt: f32): void {
    const query = this.system_query;
    query.iterator_start();  // reset the iterator
    while (query.iterator_has()) {
        const entity = query.iterator_get();
        // next use the entity
    }
}
```

It's a good idea to store all components needed for the system in local variables. This will allows to skip extracting arrays from components on each update call.

Register system within ecs
```typescript
const log_system = new LogSystem(query);
ecs.register_system(log_system);
```

Execute update methods for all systems
```typescript
ecs.update();
// or update with specific delta time value
ecs.update(0.25);
```

The state of the ECS can be stored in an array of bytes
```typescript
const bytes = ecs.to_store();
```

These bytes can be stored anywhere and used later to restore the ECS state. The structure of the ECS (components, systems and queries) should be defined before the load command and this structure should be the same
```typescript
ecs.from_store_bytes(bytes);
```

## Defer mode

It's possible to create ECS instance with activated defer mode
```typescript
const ecs = new ECS(10000, true);
```

In this mode all changes to entities (add or remove components, destroy entity) are not applied immediately, but written to a special buffer. To apply all these changes it's necessary to call ```ecs.update_pending()``` (for component changes) and `````ecs.destroy_pending()``` (for entity destruction) manually. When all changes have been made by systems, both of these methods are automatically called at the end of the ```ecs.update()``` method.

## Performance

The original [Wolf ECS](https://github.com/EnderShadow8/wolf-ecs) is one of the fastest ECS libraries for JavaScript. Current AssemblyScript implementation has almost the same performance. This implementation of ECS is heavily using access to data stored in arrays. The performance of get/set data to type arrays (such as ```Int32Array```, ```Float32Array``` and so on) in JavaScript is slightly higher than set/get data to ```StaticArray``` in AssemblyScript. So the implementation of the architecture used cannot be much more efficient in AssemblyScript than in JavaScript.

## API

### ECS class

#### Basic methods

* ```create_entity(): Entity``` Create new entity.

* ```destroy_entity(id: Entity): void```  Destroy specific entity

* ```define_component(names: Array<Symbol>, types: Array<Type>): Component``` Create and return new component with specific field names and types

* ```add_component(id: Entity, cmp: Component): void``` Add specific component to the entity

* ```remove_component(id: Entity, cmp: Component): void``` Remove component from the entity

* ```create_query(raw_queries: Array<RawQuery>): Query``` Create and return new query. ```raw_queries``` is an array of components with modificators

* ```register_system(in_system: System): void```  Add system to the list of systems. This will allow to execute ```update``` method of the system automatically

* ```update(dt: f32 = 0.0): void```  Call update methods of all registered systems

* ```destroy_pending(): void``` and ```update_pending(): void``` Apply changes with active ```defer``` mode

#### Get ECS data

* ```get_max_entities(): u32```  Return the maximum number of entities

* ```get_component(component_id: i32): Component```  Return component by specific index

* ```get_system(index: i32): System```  Return system by specific index

* ```get_entity_archetype(entity: Entity): Archetype```  Return archetype of the specific entity

* ```toString(): string``` Return string with  ECS content description (for debug purpose primary)

#### Serialization

* ```to_store(): Uint8Array``` Store ECS state into array of bytes

* ```from_store_bytes(bytes: Uint8Array): void``` Restore ECS state from array of bytes

### Query class

#### Iterations

* ```iterator_start(): void``` Reset iterator

* ```iterator_has(): bool``` Return ```true``` if there are entities for iteration, ```false``` if all entities was iterated

* ```iterator_get(): Entity``` Return current iterated entity

* ```for_each(callback: (id: Entity, ecs: ECS) => void): void``` Execute anonimus input function for all entities, match the query

#### Public methods for internal use

These method should not be used by users

* ```static match(target: Uint32Array, mask: QueryMask): bool```

* ```add_archetype(arch: Archetype): void```

* ```get_archetypes(): Array<Archetype>``` Return all archetypes, match the query

* ```get_mask(): QueryMask```

* ```get_ecs(): ECS``` Return current instance of the ECS

* ```toString(): string```

### Component class

#### Data access

Each method from the following series return array with component data of the specific type. The argument is the name of the component field
* ```get_component_array_i8(name: Symbol): StaticArray<i8>```
* ```get_component_array_i16(name: Symbol): StaticArray<i16>```
* ```get_component_array_i32(name: Symbol): StaticArray<i32>```
* ```get_component_array_i64(name: Symbol): StaticArray<i64>```
* ```get_component_array_u8(name: Symbol): StaticArray<u8>```
* ```get_component_array_u16(name: Symbol): StaticArray<u16>```
* ```get_component_array_u32(name: Symbol): StaticArray<u32```
* ```get_component_array_u64(name: Symbol): StaticArray<u64>```
* ```get_component_array_f32(name: Symbol): StaticArray<f32>```
* ```get_component_array_f64(name: Symbol): StaticArray<f64>```
* ```get_component_array_bool(name: Symbol): StaticArray<bool>```

#### Get data

* ```get_component_array_type(name: Symbol): Type``` Return type of the specific field

* ```get_id(): u32``` Return index of the component

* ```toString(): string``` Return string representaion of the component

#### Public methods for internal use

These method should not be used by users

* ```store_length(): u32```
* ```to_store(): Uint8Array```
* ```from_store(view: DataView, start: u32): void``` 

### Archetype class

#### Get data

* ```get_mask(): Uint32Array``` Return array with flags of assigned components. These flags splitted into 32-bits pieces and decoded by ```u32``` values.
*  ```get_entities(): Array<Entity>``` Return array of entities with a given archetype
* ```toString(): string``` Return string representation of the archetype (mostly for debug purpose)

#### Public methods for internal use

These method should not be used by users

* ```mask_string(): string```
* ```sset_remove(value: u32): void```
* ```sset_add(value: u32): void```
* ```get_change_length(): i32```
* ```get_change_value(index: i32): Archetype | null```
* ```set_change_value(index: u32, value: Archetype): void```
* ```set_mask(in_mask: Uint32Array): void```
* ```has(x: u32): bool```
