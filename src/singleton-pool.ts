import * as assert from "assert";
import { destroyIn, getIn, setIn } from "deepkit";
import { Disposable, DisposableComposition, isDisposable } from "using-disposable";

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
    private cache: any;

    constructor(
        private instanceFactory: InstanceFactory<TInstance, TArg>,
        private keyFactory: KeyFactory<TArg>,
    ) {
        super();
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
