import { Query, RawQuery } from "./query";
import { ECS } from "./ecs";

export abstract class System {
    private system_query: Query;
    private ecs: ECS;

    constructor(in_query: Query) {
        this.system_query = in_query;
        this.ecs = in_query.get_ecs();
    }

    get_query(): Query {
        return this.system_query;
    }

    abstract update(dt: f32): void;
}