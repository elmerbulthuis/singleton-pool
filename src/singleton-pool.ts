import { destroyIn, getIn, setIn } from "deepkit";
import { DisposableComposition, isDisposable } from "dispose";
import { toPropertyKey } from "./property-key";

export type InstanceFactory<
    TInstance extends object,
    TArg extends any[]> =
    (...arg: TArg) => TInstance | PromiseLike<TInstance>;

export type KeyFactory<
    TArg extends any[]> =
    (...args: TArg) => PropertyKey[];

interface SingletonPoolCacheItem<TInstance extends object> {
    instance: TInstance;
    proxies: Set<TInstance>;
}

export class SingletonPool<
    TInstance extends object,
    TArg extends PropertyKey[]> extends DisposableComposition {

    private readonly keyFactory: KeyFactory<TArg>;

    constructor(
        private readonly instanceFactory: InstanceFactory<TInstance, TArg>,
        keyFactory?: KeyFactory<TArg>,
    ) {
        super();

        if (keyFactory === undefined) {
            this.keyFactory = (...arg: TArg) => arg.map(toPropertyKey);
        }
        else {
            this.keyFactory = keyFactory;
        }
    }

    public async lease(...arg: TArg): Promise<TInstance> {
        const cacheKey = arg;
        const cachePath = ["cache", ...cacheKey];
        let cacheItem: SingletonPoolCacheItem<TInstance> | null = getIn(this, cachePath, null);
        let instance: TInstance;
        if (cacheItem === null) {
            instance = await this.instanceFactory(...arg);
            if (isDisposable(instance)) this.registerDisposable(instance);
            cacheItem = {
                instance,
                proxies: new Set<TInstance>(),
            };
            setIn(this, cachePath, cacheItem, true);
        } else {
            instance = cacheItem.instance;
        }
        const dispose = async () => {
            if (cacheItem === null) { throw new Error(`cacheItem is null`); }
            cacheItem.proxies.delete(proxy);
            if (cacheItem.proxies.size > 0) { return; }
            destroyIn(this, cachePath, true);
            if (isDisposable(instance)) {
                await instance.dispose();
                this.deregisterDisposable(instance);
            }
        };
        const proxyHandler: ProxyHandler<TInstance> = {
            get: (target: TInstance, propertyKey: PropertyKey, receiver: any): any => {
                if (propertyKey !== "dispose") { return Reflect.get(target, propertyKey, receiver); }
                return dispose;
            },
        };
        const proxy = new Proxy(instance, proxyHandler);
        cacheItem.proxies.add(proxy);
        return proxy;
    }

}
