import { destroyIn, getIn, setIn } from "deepkit";
import { DisposableComposition, isDisposable } from "using-disposable";
import { toPropertyKey } from "./property-key";

export type InstanceFactory<
    TInstance extends object,
    TArg extends object> =
    (arg: TArg) => TInstance | PromiseLike<TInstance>;

export type KeyFactory<
    TArg extends object> =
    (args: TArg) => PropertyKey[];

interface SingletonPoolCacheItem<TInstance extends object> {
    instance: TInstance;
    proxies: Set<TInstance>;
}

export class SingletonPool<
    TInstance extends object,
    TArg extends object> extends DisposableComposition {
    // this here is being used!!!
    private cache: any;
    private keyFactory: KeyFactory<TArg>;

    constructor(
        private instanceFactory: InstanceFactory<TInstance, TArg>,
        keyFactory?: KeyFactory<TArg>,
    ) {
        super();

        if (keyFactory === undefined) {
            this.keyFactory = (arg: TArg) => Array.isArray(arg) ?
                arg.map(key => toPropertyKey(key)) :
                Object.keys(arg).
                    sort().
                    map(key => toPropertyKey(arg[key as keyof TArg]));
        }
        else this.keyFactory = keyFactory;
    }

    public async lease(arg: TArg): Promise<TInstance> {
        const cacheKey = this.keyFactory(arg);
        const cachePath = ["cache", ...cacheKey];
        let cacheItem: SingletonPoolCacheItem<TInstance> | null = getIn(this, cachePath, null);
        let instance: TInstance;
        if (cacheItem === null) {
            instance = await this.instanceFactory(arg);
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
