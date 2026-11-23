// Model assets and execution are loaded only after the user submits the first local question.
let engine;
self.onmessage = async ({data}) => {
  try {
    if (!engine) {
      if (!self.navigator.gpu || !await self.navigator.gpu.requestAdapter()) throw Error('当前浏览器无法提供 WebGPU。可使用本机 Ollama 或选择云端接口。');
      const lib = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/lib/index.js');
      engine = await lib.CreateMLCEngine('Qwen2.5-0.5B-Instruct-q4f32_1-MLC', {
        initProgressCallback: p => {
          const info=String(p.text||'');
          const fetched=info.match(/([\d.]+)MB fetched.*?([\d.]+)%/i);
          const progress=fetched?'正在下载 Qwen · '+fetched[1]+' MB · '+fetched[2]+'%':'正在准备 Qwen 模型与显卡计算资源…';
          self.postMessage({progress});
        }
      });
    }
    const output = await engine.chat.completions.create({messages:data.messages,stream:false,max_tokens:350,temperature:0.25});
    self.postMessage({output:{text:output.choices?.[0]?.message?.content,usage:output.usage}});
  } catch (err) {self.postMessage({error:String(err?.message || err).slice(0,400)});}
};
