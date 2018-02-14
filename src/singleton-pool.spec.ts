import * as test from "blue-tape";
import { Disposable } from "using-disposable";
import { SingletonPool } from "./singleton-pool";

class Dummy implements Disposable {
    public static create(value: string) {
        return new Dummy(value);
    }

    public key = Symbol();
    public isDisposed = false;
    private constructor(public value: string) {

    }

    public dispose() {
        if (this.isDisposed) return;
        this.isDisposed = true;
    }
}

test("singleton-pool", async t => {
    const pool = new SingletonPool(
        ([value]: [string]) => Dummy.create(value),
        (...args: any[]) => args,
    );

    const d = await pool.lease(["a"]);
    const d1 = await pool.lease(["a"]);
    t.equal(d1.key, d.key);

    await d.dispose();
    t.equal(d.isDisposed, false);

    await d.dispose();
    t.equal(d.isDisposed, false);

    const d2 = await pool.lease(["a"]);
    t.equal(d2.key, d.key);
    t.equal(d.isDisposed, false);

    await d1.dispose();
    await d2.dispose();
    t.equal(d.isDisposed, true);
    t.equal(d1.key, d.key);
    t.equal(d2.key, d.key);

    const d3 = await pool.lease(["a"]);
    t.notEqual(d3.key, d.key);

    pool.dispose();
    t.equal(d3.isDisposed, true);
});

test("singleton-pool-array", async t => {
    const pool = new SingletonPool(
        ([value]: [string]) => Dummy.create(value),
    );

    const d = await pool.lease(["a"]);
    const d1 = await pool.lease(["a"]);
    t.equal(d1.key, d.key);

    await d.dispose();
    t.equal(d.isDisposed, false);

    await d.dispose();
    t.equal(d.isDisposed, false);

    const d2 = await pool.lease(["a"]);
    t.equal(d2.key, d.key);
    t.equal(d.isDisposed, false);

    await d1.dispose();
    await d2.dispose();
    t.equal(d.isDisposed, true);
    t.equal(d1.key, d.key);
    t.equal(d2.key, d.key);

    const d3 = await pool.lease(["a"]);
    t.notEqual(d3.key, d.key);

    pool.dispose();
    t.equal(d3.isDisposed, true);
});

test("singleton-pool-factory-instance-error", async t => {
    const pool = new SingletonPool(
        ([value]: [string]) => {
            throw new Error("hi");
        },
    );
    try {
        const d = await pool.lease(["a"]);
        t.fail();
    }
    catch (err) {
        t.pass();
    }
});
