## What is it?

This is a port of the [Wolf ECS](https://github.com/EnderShadow8/wolf-ecs) system into AssemblyScript. This repository should be used as part of another AssemblyScript project. The architecture uses the SoA approach to store data for components. In this case, for each data field of the component, the array with values for all entities is created. This architecture uses more memory, but it is more performance compared to the object-based architecture.

## Ho to use

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
