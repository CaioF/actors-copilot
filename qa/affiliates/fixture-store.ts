// Firestore boundary used by Jest only. Preserve server-assigned creation times
// across updates, and assign a new generation after a delete and re-create.
export function fixtureStore() {
  type Data = Record<string, unknown>;
  type Ref = { path: string };
  const entries = new Map<string, { data: Data; generation: number }>();
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();
  function write(path: string, data: Data, merge = false) {
    const current = entries.get(path);
    entries.set(path, {
      data: merge ? { ...current?.data, ...data } : { ...data },
      generation: current?.generation ?? ++generation,
    });
  }
  function snapshot(path: string) {
    const value = entries.get(path);
    return {
      id: path.split('/').at(-1),
      exists: !!value,
      data: () => value?.data,
      createTime: value ? { seconds: 100, nanoseconds: value.generation } : undefined,
    };
  }
  const doc = (path: string) => ({
    path,
    get: async () => snapshot(path),
    set: async (data: Data, o?: { merge?: boolean }) => write(path, data, o?.merge),
  });
  const query = (name: string, field?: string, v?: unknown) => ({
    docs: [...entries.keys()]
      .filter(
        (p) =>
          p.startsWith(name + '/') &&
          p.split('/').length === 2 &&
          (!field || entries.get(p)?.data[field] === v),
      )
      .map(snapshot),
  });
  return {
    clear: () => entries.clear(),
    seed: write,
    read: (path: string) => entries.get(path)?.data,
    remove: (path: string) => entries.delete(path),
    doc,
    getAll: async (...refs: Ref[]) => refs.map((item) => snapshot(item.path)),
    collection: (name: string) => ({
      doc: (id: string) => doc(name + '/' + id),
      get: async () => query(name),
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => query(name, field, value),
      }),
    }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const result = tail.then(() =>
        fn({
          get: async (ref: Ref) => snapshot(ref.path),
          set: (ref: Ref, d: Data, o?: { merge?: boolean }) => write(ref.path, d, o?.merge),
          delete: (ref: Ref) => entries.delete(ref.path),
        }),
      );
      tail = result.catch(() => {});
      return result;
    },
  };
}
