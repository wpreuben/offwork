// Each confirmed choice is written to an actual JSON file in OPFS.
const NAME = 'CCBOT-KO';
const id = () => crypto.randomUUID().replaceAll('-', '');
const fileName = value => {
  if (!/^[0-9a-f]{32}$/.test(value)) throw Error('저장 ID가 올바르지 않습니다.');
  return `${value}.json`;
};

export class JsonStore {
  constructor(directory, lockName) { this.directory = directory; this.lockName = lockName; }

  static async open() {
    if (!navigator.storage?.getDirectory || !navigator.locks) throw Error('브라우저 내부 JSON 저장을 사용할 수 없습니다. HTTPS 또는 localhost에서 최신 브라우저로 열어 주세요.');
    const lockName = 'ccbot-ko-' + encodeURIComponent(new URL('.', location.href).pathname);
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(lockName, {create:true});
    return new JsonStore(directory, lockName);
  }

  async read(value) {
    const handle = await this.directory.getFileHandle(fileName(value));
    const data = JSON.parse(await (await handle.getFile()).text());
    this.validate(data);
    return data;
  }

  validate(data) {
    if (data?.app !== NAME || data.version !== 2 || !/^[0-9a-f]{32}$/.test(data.id) || !Number.isInteger(data.revision) || data.revision < 0 || data.state?.version !== 1 || !Array.isArray(data.history)) throw Error('Combat Commander 저장 JSON 형식이 올바르지 않습니다.');
  }

  async write(state, history, value, expectedRevision) {
    return navigator.locks.request(this.lockName, async () => {
      const saveId = value || id();
      let old;
      try { old = await this.read(saveId); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      if ((old?.revision ?? -1) !== expectedRevision) throw Error('다른 탭에서 저장한 내용이 있습니다. 저장된 게임을 다시 불러와 주세요.');
      const data = {app:NAME, version:2, id:saveId, revision:expectedRevision+1, updatedAt:new Date().toISOString(), state, history};
      const handle = await this.directory.getFileHandle(fileName(saveId), {create:true});
      const writer = await handle.createWritable();
      try { await writer.write(JSON.stringify(data, null, 2) + '\n'); await writer.close(); }
      catch (error) { await writer.abort().catch(()=>{}); throw error; }
      return data;
    });
  }

  async listing() {
    return navigator.locks.request(this.lockName, async () => {
      const result=[];
      for await (const [name, handle] of this.directory.entries()) {
        if (!/^[0-9a-f]{32}\.json$/.test(name)) continue;
        try {
          const data=JSON.parse(await (await handle.getFile()).text());
          this.validate(data);
          result.push({id:data.id, updatedAt:data.updatedAt, nation:data.state.nation, turn:data.state.turn, stage:data.state.stage});
        } catch { /* A damaged file is left untouched and excluded from the list. */ }
      }
      return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    });
  }
}
