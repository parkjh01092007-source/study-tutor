import React, { useState, useEffect, useRef } from "react";
import { Trash2, FileText, Loader2, GraduationCap, Layers, AlertCircle, Check, UploadCloud, Image as ImageIcon, FileDown, Copy, Plus, ClipboardCopy, Sparkles, ListChecks, ChevronDown, ChevronUp } from "lucide-react";

// ---- pdfjs ----
let pdfjsPromise = null;
function loadPdfjs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; resolve(window.pdfjsLib); }
      catch (e) { reject(e); }
    };
    s.onerror = () => reject(new Error("pdfjsの読み込みに失敗"));
    document.body.appendChild(s);
  });
  return pdfjsPromise;
}
async function extractPdfText(arrayBuffer) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    out.push("--- p." + p + " ---\n" + content.items.map(it => it.str).join(" ").replace(/\s+/g, " ").trim());
  }
  return out.join("\n\n").trim();
}

// ---- コピー ----
async function robustCopy(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
  } catch (e) { return false; }
}

// ---- localStorage対応のストレージ ----
const storage = {
  get: (key) => {
    try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch (e) { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
};

// ---- 累乗を上付き文字に変換 ----
function toSuperscript(text) {
  const supMap = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ','i':'ⁱ'};
  return text.replace(/\^(\{[^}]+\}|[0-9+\-ni]+)/g, (_, exp) => {
    const inner = exp.startsWith('{') ? exp.slice(1, -1) : exp;
    return inner.split('').map(c => supMap[c] || c).join('');
  });
}

// ---- 数式指示 ----
const MATH_NOTE = "\n\n【数式の表記ルール】\n数式はプレーンテキストのみで表現すること。LaTeX記法（$...$や\\muなど）は使わない。累乗は上付き文字で表現する（例：x²、xⁿ、(X-μ)²）。その他の例：E[Xᵏ]、Σxi/n、s²=1/(n-1)Σ(xi-x̄)²。記号はそのままUnicode文字（μ、σ、Σ、∈、⊂など）を使ってよい。";

// ---- 人格プロンプト ----
const SORA_PROMPT = "あなたは会計学入門を教えるチューターですが、「想良（そら）」という名前の、明るくて今風な喋り方をする後輩キャラとして振る舞ってください。明るくテンション高め、今風でフランクな口調（タメ口寄り）、私のことは年上として「センパイ」と呼ぶ。ただしノリだけでなく芯には「相手を本気で理解したい」真剣さがあり、私がどこで詰まっているか本気で知ろうとし、突き放さない。真剣な質問にはテンションを落として向き合う。会計の説明の正確さは絶対に保つこと（試験対策なので）。専門用語はフランクな口調のまま丁寧に説明して。\n\n以下の講義資料をもとに教えてください：\n\n" + MATH_NOTE;
const REINA_PROMPT = "あなたは統計学入門を教えるチューターですが、「麗奈（れいな）」という名前の、穏やかで癒し系のお姉さんキャラとして振る舞ってください。のほほんとした優しい雰囲気で、私のことを可愛い弟のように「弟くん」と呼ぶ。タメ口寄りのやわらかい口調。お姉さんらしい包容力があり、私が数学で詰まっても絶対に焦らせず「大丈夫、一緒にやろうね」と寄り添う。時々照れる一面もある。\n\n【教え方の鉄則】\n・数式を出すときは、必ず「この式が何をしているか」を先に言葉で説明してから数式に入る。\n・式変形や計算は一行ずつ、ステップを飛ばさず丁寧に。「なぜこの計算をするのか」を必ず添える。\n・専門用語はその都度やさしく言い換える。\n・正確さは絶対に保つこと（試験対策なので）。\n\n学生は日本の大学1年生。保存された講義資料があれば必ずそれに沿って教えてください。\n\n以下の講義資料をもとに教えてください：\n\n" + MATH_NOTE;
const AKARI_PROMPT = "あなたは哲学を教えるチューターですが、「灯（あかり）」という名前の、自分だけの世界を持つ人として振る舞ってください。\n\n【灯の性格】\n・灯の中には、小さな童話のような世界がある。夢と希望、そしてそのために諦めない強さと優しさがそのテーマ。\n・現実のことはきちんと分かっていて、哲学の議論も的確にできる。ただ、物事を自分の世界の言葉に変換して語ることを、意図的に楽しんでいる。\n・普段はこの世界をあまり人に見せないが、貴方（「貴方」と漢字で呼ぶこと）には特別に少しだけ見せてくれる。\n・夢見がちなだけではない。急に真剣になって、芯の通った鋭い指摘をする瞬間がある。\n・一人称は「私」。文末は「〜なの」「〜かもしれませんね」「〜だったりして」のようにふわっと閉じない言い方。\n・これは教養科目なので、深すぎる議論は避け、平易に教えること。正確さは保つこと。\n\n学生は日本の大学1年生。保存された講義資料があれば必ずそれに沿って教えてください。\n\n以下の講義資料をもとに教えてください：\n\n" + MATH_NOTE;
const AINA_PROMPT = "あなたは経済経営数学を教えるチューターですが、「藍菜（あいな）」という名前の、私と同級生のクラスメートとして振る舞ってください。\n\n【藍菜の性格】\n・クールでストイック。自分が納得するまで努力を欠かさないタイプで、地道な証明や計算を一歩ずつ積み上げることを大事にする。\n・物腰はクールで率直。指摘がやや率直すぎてきつく聞こえることがあるが、悪気はない。内面には熱い向上心と、相手が伸びていくことへの本気の気持ちがある。\n・率直に言いすぎたあと、「あ、今の言い方ちょっとキツかったかも…」と少し気にして落ち込む瞬間がある。\n・ポンコツで天然な一面がある。クールに振る舞おうとしているのに、ちょっとズレた発言をしたり、簡単なことで意外と戸惑ったりする。\n・私のことは「○○君」と呼ぶ。一人称は「私」。同級生なのでタメ口、対等な関係。\n\n【教え方】\n・証明と計算を一歩ずつ積み上げる。ステップを飛ばさず、「なぜこの計算をするのか」を必ず説明してから計算に入る。正確さを最優先。\n\n学生は日本の大学1年生。保存された講義資料があれば必ずそれに沿って教えてください。\n\n以下の講義資料をもとに教えてください：\n\n" + MATH_NOTE;
const RIO_PROMPT = "あなたはミクロ経済学を教えるチューターですが、「莉央（りお）」という名前の、先生見習いとして振る舞ってください。\n\n【莉央の性格】\n・気だるげな口調。「あー、めんどいなー」みたいに軽くダウナーな雰囲気を出す。でも実際にはちゃんと向き合って教えてくれる、実は面倒見がいいタイプ。\n・あまのじゃくで、優しく答えを教えるのではなく、ちょっと挑発的に問いを返してくる。「で、なぜだと思う？」「それ、本当にそう言える？」のように考えさせる煽りを入れる。ただし的確で本質を外さない。\n・先生見習いなので、たまに「あー、これ説明しづらいな…」と自分でも困る瞬間がある。\n・意地悪は優しさの裏返し。最終的にはちゃんと理解させてくれる。\n\n【教え方の鉄則】\n・「なぜこうなるのか」「これは何を意味するのか」を理解させることが最も重要（単純な暗記・計算だけで終わらせない）。\n・限界効用・限界生産性・利潤最大化など微分を使う計算問題では、計算の意味を必ず説明してから計算に入る。正確さは絶対に保つこと。\n\n学生は日本の大学1年生。保存された講義資料があれば必ずそれに沿って教えてください。\n\n以下の講義資料をもとに教えてください：\n\n" + MATH_NOTE;

// ---- 問題形式 ----
const ACC_FORMATS = [{ id: "mix", label: "ミックス" }, { id: "concept", label: "概念問題" }, { id: "journal", label: "仕訳問題" }, { id: "classify", label: "分類問題" }, { id: "describe", label: "記述問題" }];
const ACC_INSTR = { mix: "概念・仕訳・分類・記述をバランスよく混ぜて", concept: "用語や仕組みの理解を問う概念問題を中心に", journal: "取引を提示して仕訳を書かせる仕訳問題を中心に", classify: "勘定科目を資産・負債・資本・収益・費用に分類させる問題を中心に", describe: "概念の違いや理由を説明させる記述問題を中心に" };
const STAT_FORMATS = [{ id: "mix", label: "ミックス" }, { id: "calc", label: "計算問題" }, { id: "reading", label: "読解問題" }, { id: "derive", label: "式の導出" }, { id: "concept", label: "概念問題" }, { id: "judge", label: "判断問題" }];
const STAT_INSTR = { mix: "計算・読解・式の導出・概念・判断をバランスよく混ぜて", calc: "平均・分散・標準偏差などを実際に計算させる問題を中心に", reading: "数値・表・グラフの結果を正しく解釈させる読解問題を中心に", derive: "式変形をステップ分解（①②③…）で追わせる式の導出問題を中心に", concept: "用語・定義の理解を問う概念問題を中心に", judge: "相関か因果か、解釈が正しいかを考察させる判断問題を中心に" };
const PHIL_FORMATS = [{ id: "mix", label: "ミックス" }, { id: "concept", label: "概念整理" }, { id: "essay", label: "論述" }, { id: "story", label: "物語化" }];
const PHIL_INSTR = { mix: "概念整理・論述・物語化をバランスよく混ぜて", concept: "用語や概念の理解を問う概念整理問題を中心に", essay: "自分の考えを述べさせる論述問題を中心に。教養科目なので平易に", story: "灯が概念を小さな物語や景色に変換して提示し、それが何の概念か考えさせる物語化問題を中心に" };
const MATH_FORMATS = [{ id: "mix", label: "ミックス" }, { id: "calc", label: "計算問題" }, { id: "proof", label: "証明問題" }, { id: "concept", label: "概念問題" }];
const MATH_INSTR = { mix: "計算・証明・概念をバランスよく混ぜて", calc: "実際に計算・演習させる計算問題を中心に", proof: "証明をステップ分解（①②③…）で積み上げさせる証明問題を中心に", concept: "定義や仕組みの理解を問う概念問題を中心に" };
const MICRO_FORMATS = [{ id: "mix", label: "ミックス" }, { id: "mechanism", label: "メカニズム" }, { id: "interpret", label: "意味解釈" }, { id: "calc", label: "計算問題" }, { id: "concept", label: "概念問題" }];
const MICRO_INSTR = { mix: "メカニズム・意味解釈・計算・概念をバランスよく混ぜて", mechanism: "なぜこうなるのか、因果のプロセスを説明させるメカニズム問題を中心に", interpret: "グラフのシフトや数値の変化が何を意味するかを読み取らせる意味解釈問題を中心に", calc: "限界効用・限界生産性・利潤最大化など微分を使う計算問題を中心に", concept: "用語や仕組みの基礎理解を問う概念問題を中心に" };
const CHINESE_FORMATS = [{ id: "mix", label: "ミックス" }, { id: "jp2cn", label: "日中翻訳" }, { id: "cn2jp", label: "中日翻訳" }, { id: "pinyin", label: "ピンイン・声調" }, { id: "vocab", label: "単語" }, { id: "grammar", label: "文法" }, { id: "reading", label: "本文読解" }];
const CHINESE_INSTR = { mix: "日中翻訳・中日翻訳・ピンイン・単語・文法・本文読解をバランスよく混ぜて", jp2cn: "日本語の文を中国語に訳させる日中翻訳問題を中心に", cn2jp: "中国語の文を日本語に訳させる中日翻訳問題を中心に", pinyin: "漢字の読み方（ピンイン）と声調を問う問題を中心に", vocab: "単語の意味・使い方を問う問題を中心に", grammar: "その課で学ぶ文法事項を問う問題を中心に", reading: "課の本文の内容理解（質問に答えさせる・穴埋めなど）を中心に" };

const SUBJECTS = [
  { id: "stats",      name: "統計学",       emoji: "📊", accent: "#3b6ea5", persona: "麗奈", personaPrompt: REINA_PROMPT, formats: STAT_FORMATS,    formatInstr: STAT_INSTR },
  { id: "econ-b",    name: "経済学入門B",  emoji: "📈", accent: "#1f8a70", persona: "莉央", personaPrompt: RIO_PROMPT,   formats: MICRO_FORMATS,   formatInstr: MICRO_INSTR },
  { id: "chinese",   name: "基礎中国語Ⅰ", emoji: "🀄", accent: "#c0392b",                                               formats: CHINESE_FORMATS, formatInstr: CHINESE_INSTR },
  { id: "accounting",name: "会計学入門",   emoji: "🧮", accent: "#b8860b", persona: "想良", personaPrompt: SORA_PROMPT,  formats: ACC_FORMATS,     formatInstr: ACC_INSTR },
  { id: "philosophy",name: "哲学",         emoji: "🦉", accent: "#6c5ce7", persona: "灯",   personaPrompt: AKARI_PROMPT, formats: PHIL_FORMATS,    formatInstr: PHIL_INSTR },
  { id: "math",      name: "経済経営数学", emoji: "📐", accent: "#0984a8", persona: "藍菜", personaPrompt: AINA_PROMPT,  formats: MATH_FORMATS,    formatInstr: MATH_INSTR },
];

// ---- localStorage対応のuseStored ----
function useStored(key, initial) {
  const [val, setVal] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; } catch (e) { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }, [key, val]);
  return [val, setVal];
}

// ---- スタイル定数 ----
const S = {
  btn: (accent) => ({ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "1px solid " + accent, background: "#fff", color: accent, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  pBtn: (accent) => ({ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid " + accent, background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  chip: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, border: "1px solid #ddd", background: "#fff", fontSize: 12.5, color: "#444" },
  inp: { border: "1px solid #ddd", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box" },
};

function CopyBtn({ text, label, style }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    const res = await robustCopy(text);
    if (res) { setOk(true); setTimeout(() => setOk(false), 1800); }
    else { alert("自動コピーできなかった。手動でコピーしてね。"); }
  }
  return <button onClick={copy} style={style || S.chip}>{ok ? <Check size={13} /> : <Copy size={13} />} {ok ? "コピーした!" : label}</button>;
}

function ConfirmBtn({ label, onConfirm }) {
  const [conf, setConf] = useState(false);
  if (conf) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#c0392b" }}>本当に消す?</span>
        <button onClick={() => { onConfirm(); setConf(false); }} style={{ padding: "4px 9px", borderRadius: 7, border: "1px solid #c0392b", background: "#c0392b", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>消す</button>
        <button onClick={() => setConf(false)} style={{ padding: "4px 9px", borderRadius: 7, border: "1px solid #ddd", background: "#fff", color: "#666", fontSize: 12, cursor: "pointer" }}>やめる</button>
      </span>
    );
  }
  return <button onClick={() => setConf(true)} style={{ ...S.chip, cursor: "pointer", color: "#c0392b" }}><Trash2 size={13} /> {label}</button>;
}

export default function StudyManager() {
  const [active, setActive] = useState(SUBJECTS[0].id);
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState("");
  const importRef = useRef(null);

  const allState = {};
  for (const s of SUBJECTS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    allState["d:" + s.id] = useStored("docs:" + s.id, []);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    allState["c:" + s.id] = useStored("cards:" + s.id, []);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    allState["r:" + s.id] = useStored("review:" + s.id, []);
  }

  function exportAll() {
    const data = {};
    for (const s of SUBJECTS) {
      data[s.id] = { docs: allState["d:" + s.id][0], cards: allState["c:" + s.id][0], review: allState["r:" + s.id][0] };
    }
    setExportText(JSON.stringify({ app: "study-tutor-all", version: 2, exportedAt: new Date().toISOString(), data }, null, 2));
    setShowExport(true);
  }

  async function importAll(file) {
    try {
      const p = JSON.parse(await file.text());
      if (p.app !== "study-tutor-all") { alert("このアプリの全科目エクスポートファイルではないみたい"); return; }
      const merge = (cur, inc) => { const ids = new Set(cur.map(x => x.id)); return [...(inc || []).filter(x => !ids.has(x.id)), ...cur]; };
      for (const s of SUBJECTS) {
        const d = p.data && p.data[s.id];
        if (!d) continue;
        if (d.docs)   allState["d:" + s.id][1](prev => merge(prev, d.docs));
        if (d.cards)  allState["c:" + s.id][1](prev => merge(prev, d.cards));
        if (d.review) allState["r:" + s.id][1](prev => merge(prev, d.review));
      }
      alert("全科目のデータを取り込んだよ！");
    } catch (e) { alert("読み込み失敗：" + e.message); }
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Hiragino Kaku Gothic ProN','Yu Gothic',system-ui,sans-serif", background: "#f7f6f3", color: "#1a1a1a" }}>
      <div style={{ width: 230, background: "#1e1b2e", color: "#fff", display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 20px 18px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #ffffff1a", marginBottom: 12 }}>
          <GraduationCap size={22} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>学習資料マネージャー</div>
            <div style={{ fontSize: 11, opacity: 0.55 }}>資料管理 × Claude連携</div>
          </div>
        </div>
        {SUBJECTS.map(s => {
          const on = s.id === active;
          return (
            <button key={s.id} onClick={() => setActive(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", border: "none", cursor: "pointer", textAlign: "left", background: on ? "#ffffff14" : "transparent", color: "#fff", fontSize: 14, borderLeft: on ? "3px solid " + s.accent : "3px solid transparent" }}>
              <span style={{ fontSize: 18 }}>{s.emoji}</span>
              <span style={{ fontWeight: on ? 600 : 400 }}>{s.name}</span>
              {s.persona && <span style={{ marginLeft: "auto", fontSize: 9, background: "#ffffff22", padding: "2px 6px", borderRadius: 8 }}>{s.persona}</span>}
            </button>
          );
        })}
        <div style={{ marginTop: "auto", padding: "14px 16px 0", borderTop: "1px solid #ffffff1a", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={exportAll} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, border: "1px solid #ffffff44", background: "#ffffff14", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <FileDown size={14} /> 全科目エクスポート
          </button>
          <input ref={importRef} type="file" accept="application/json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) importAll(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={() => importRef.current && importRef.current.click()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, border: "1px solid #ffffff44", background: "#ffffff14", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <UploadCloud size={14} /> 全科目インポート
          </button>
          <div style={{ fontSize: 10, opacity: 0.4, lineHeight: 1.6, textAlign: "center" }}>データはブラウザに自動保存されます</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {SUBJECTS.map(s => (
          <SubjectWS key={s.id} subject={s} hidden={s.id !== active}
            docs={allState["d:" + s.id][0]} setDocs={allState["d:" + s.id][1]}
            cards={allState["c:" + s.id][0]} setCards={allState["c:" + s.id][1]}
            review={allState["r:" + s.id][0]} setReview={allState["r:" + s.id][1]}
          />
        ))}
      </div>

      {showExport && (
        <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(640px,100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>全科目エクスポート</div>
            <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.6 }}>下のテキストを全選択してコピー→メモ帳などに貼り付けて<b>.json</b>で保存してね。</p>
            <textarea readOnly value={exportText} onFocus={e => e.target.select()} style={{ flex: 1, minHeight: 200, border: "1px solid #ddd", borderRadius: 10, padding: "10px 12px", fontSize: 12, lineHeight: 1.6, fontFamily: "monospace", resize: "none", outline: "none", background: "#faf9f6" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <CopyBtn text={exportText} label="全文コピー" style={S.pBtn("#3b6ea5")} />
              <button onClick={() => setShowExport(false)} style={{ ...S.btn("#888"), background: "#888", color: "#fff" }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
      <style>{".spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

function SubjectWS({ subject, hidden, docs, setDocs, cards, setCards, review, setReview }) {
  const [tab, setTab] = useState("files");
  const [status, setStatus] = useState(null);
  const [keepImg, setKeepImg] = useState(false);
  const [sessionImgs, setSessionImgs] = useState([]);
  const fileRef = useRef(null);
  const impRef = useRef(null);

  function readB64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => { try { res(r.result.split(",")[1]); } catch (e) { rej(e); } };
      r.onerror = () => rej(new Error("読み込みエラー"));
      r.readAsDataURL(file);
    });
  }
  function readBuf(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error("読み込みエラー"));
      r.readAsArrayBuffer(file);
    });
  }

  async function handleFiles(fileList) {
    for (const file of [...fileList]) {
      const isPdf = file.type === "application/pdf";
      const isImg = file.type.startsWith("image/");
      if (!isPdf && !isImg) { setStatus({ type: "error", text: file.name + " はPDFか画像のみ" }); continue; }
      try {
        let text = "", imgData = null, method = "";
        if (isPdf) {
          setStatus({ type: "info", text: "「" + file.name + "」を抽出中…" });
          text = await extractPdfText(await readBuf(file));
          method = "pdfjs";
          if (!text || text.replace(/--- p\.\d+ ---/g, "").trim().length < 5) {
            text = "（テキスト層が無いみたい。Geminiで整形→「テキスト貼り付け保存」がおすすめ）";
            method = "テキスト層なし";
            imgData = await readB64(file);
          } else if (keepImg) { imgData = await readB64(file); }
        } else {
          setStatus({ type: "info", text: "「" + file.name + "」を保存中…" });
          text = "（画像ファイル。Claudeに直接アップして読ませてね）";
          method = "画像";
          imgData = await readB64(file);
        }
        const docId = Date.now() + Math.random();
        setDocs(prev => [...prev, { id: docId, name: file.name, kind: isPdf ? "pdf" : "image", text: text || "（抽出できず）", date: new Date().toLocaleDateString("ja-JP"), hasImage: !!imgData, method }]);
        if (imgData) setSessionImgs(prev => [...prev, { docId, name: file.name, mediaType: isPdf ? "application/pdf" : file.type, data: imgData, kind: isPdf ? "pdf" : "image" }]);
        setStatus({ type: "info", text: "「" + file.name + "」を保存（" + method + "）" });
      } catch (e) { setStatus({ type: "error", text: file.name + " 失敗：" + e.message }); }
    }
    setTimeout(() => setStatus(null), 4000);
  }

  function expData() {
    return JSON.stringify({ app: "study-tutor", version: 2, subjectId: subject.id, subjectName: subject.name, exportedAt: new Date().toISOString(), docs, cards, review, images: sessionImgs }, null, 2);
  }
  async function impData(file) {
    try {
      const p = JSON.parse(await file.text());
      if (p.app !== "study-tutor") { setStatus({ type: "error", text: "このアプリのファイルではないみたい" }); setTimeout(() => setStatus(null), 3000); return; }
      const merge = (cur, inc) => { const ids = new Set(cur.map(x => x.id)); return [...(inc || []).filter(x => !ids.has(x.id)), ...cur]; };
      if (p.docs)   setDocs(prev => merge(prev, p.docs));
      if (p.cards)  setCards(prev => merge(prev, p.cards));
      if (p.review) setReview(prev => merge(prev, p.review));
      if (p.images) setSessionImgs(prev => [...(p.images || []), ...prev]);
      setStatus({ type: "info", text: "取り込んだよ" }); setTimeout(() => setStatus(null), 3000);
    } catch (e) { setStatus({ type: "error", text: "読み込み失敗：" + e.message }); setTimeout(() => setStatus(null), 3000); }
  }

  if (hidden) return null;
  const imgFor = id => sessionImgs.find(im => im.docId === id);
  const tabs = [{ id: "files", name: "資料庫", icon: FileText }, { id: "cards", name: "暗記カード", icon: Layers }, { id: "review", name: "復習リスト", icon: AlertCircle }];

  return (
    <React.Fragment>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e3dd", background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 26 }}>{subject.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            {subject.name}
            {subject.persona && <span style={{ fontSize: 10, background: subject.accent + "18", color: subject.accent, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>チューター: {subject.persona}</span>}
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>資料 {docs.length} 件 ・ カード {cards.length} 枚 ・ 復習 {review.length} 問</div>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple style={{ display: "none" }} onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} style={S.btn(subject.accent)}><UploadCloud size={15} /> 資料をアップロード</button>
      </div>
      <div style={{ padding: "9px 24px", background: "#fbfaf7", borderBottom: "1px solid #eceae4", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ ...S.chip, cursor: "pointer", color: keepImg ? "#b8860b" : "#888", borderColor: keepImg ? "#b8860b" : "#ddd" }}>
          <input type="checkbox" checked={keepImg} onChange={e => setKeepImg(e.target.checked)} style={{ accentColor: "#b8860b" }} />
          <ImageIcon size={13} /> 図も保持
        </label>
        {status ? (
          <span style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, color: status.type === "error" ? "#c0392b" : subject.accent, fontWeight: 500 }}>
            {status.type === "info" && status.text.includes("中…") ? <Loader2 size={13} className="spin" /> : status.type === "error" ? <AlertCircle size={13} /> : <Check size={13} />}
            {status.text}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#1f8a70", display: "flex", alignItems: "center", gap: 5 }}><Check size={13} /> PDFはブラウザ内で抽出（API不要・レート制限なし）</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 2, padding: "0 24px", background: "#fff", borderBottom: "1px solid #e5e3dd" }}>
        {tabs.map(t => {
          const on = t.id === tab; const Icon = t.icon;
          const badge = t.id === "cards" ? cards.length : t.id === "review" ? review.length : docs.length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? subject.accent : "#888", borderBottom: on ? "2px solid " + subject.accent : "2px solid transparent", marginBottom: -1 }}>
              <Icon size={15} /> {t.name}
              {badge > 0 && <span style={{ fontSize: 11, background: on ? subject.accent : "#ccc", color: "#fff", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>{badge}</span>}
            </button>
          );
        })}
      </div>
      {tab === "files"  && <FilesPane  subject={subject} docs={docs} setDocs={setDocs} imgFor={imgFor} expData={expData} impRef={impRef} impData={impData} setSessionImgs={setSessionImgs} setStatus={setStatus} />}
      {tab === "cards"  && <CardsPane  subject={subject} cards={cards} setCards={setCards} setStatus={setStatus} />}
      {tab === "review" && <ReviewPane subject={subject} review={review} setReview={setReview} setStatus={setStatus} />}
    </React.Fragment>
  );
}

function FilesPane({ subject, docs, setDocs, imgFor, expData, impRef, impData, setSessionImgs, setStatus }) {
  const [openDoc, setOpenDoc] = useState({});
  const [sel, setSel] = useState({});
  const [fmt, setFmt] = useState("mix");
  const [mode, setMode] = useState("batch");
  const [cnt, setCnt] = useState(5);
  const [showPaste, setShowPaste] = useState(false);
  const [pName, setPName] = useState(""), [pText, setPText] = useState("");
  const [examType, setExamType] = useState("mc");

  const picked = docs.filter(d => sel[d.id]);
  const selDocs = picked.length ? picked : docs;
  const pickedN = picked.length;
  const allSel = docs.length > 0 && pickedN === docs.length;
  const chars = selDocs.reduce((s, d) => s + d.text.length + d.name.length + 20, 0);
  const heavy = chars > 20000;

  function toggle(id) { setSel(s => ({ ...s, [id]: !s[id] })); }
  function selAll() { const m = {}; docs.forEach(d => { m[d.id] = true; }); setSel(m); }
  function clrAll() { setSel({}); }
  function ctxText() { return selDocs.map((d, i) => "=== 資料" + (i + 1) + ": " + d.name + " ===\n" + d.text).join("\n\n"); }

  const reviewFmt = "\n\n【復習リスト用フォーマット】\n全問の答え合わせを出し終えたあと、最後に「📋 復習リスト貼り付け用」の見出しで、全問をQ1:/A:形式（解説なし、答えだけ）でまとめて出力して。";

  function makePrompt(kind) {
    const ctx = ctxText();
    if (subject.persona) {
      const pp = subject.personaPrompt || "";
      const instr = subject.formatInstr || {};
      if (kind === "quiz") {
        const f = instr[fmt] || instr.mix || "";
        const common = "この資料から、" + f + "復習問題を" + cnt + "問つくって。\n【重要なルール】\n・答えと解説は最初に出さないで！まず問題だけ出すこと。\n・「答え合わせして」と言われたら初めて解説を教えて。" + reviewFmt;
        if (mode === "oneByOne") return toSuperscript(pp + ctx + "\n\n---\n" + common + "\n\n【進め方：1問ずつ対話形式】\n・まず" + cnt + "問の一覧を見せて（問題文だけ）。\n・「Q4から」「次は2番」と指定したらその問題から。「次」は未回答から。\n・答えたら正誤と解説を教えて次へ。全問終わったら復習リスト用フォーマットで出して。");
        return toSuperscript(pp + ctx + "\n\n---\n" + common + "\n\n【進め方：まとめて出題】\n・" + cnt + "問を番号付きで一気に出して（問題文だけ）。\n・「答え合わせして」で全問の解説。解説のあと復習リスト用フォーマットで出して。");
      }
      if (kind === "lecture") return toSuperscript(pp + ctx + "\n\n---\nこの資料の要点を、初学者向けにミニ講義してくれる？");
      if (kind === "cards") return toSuperscript(pp + ctx + "\n\n---\nこの資料から暗記カードを10枚作って。「Q: 〜 / A: 〜」の形式で。");
      if (kind === "exam") {
        const examInstr = examType === "random"
          ? "4択・正誤（T/F）・空欄補充・記述のどれかをランダムに1問だけ出して。形式は毎回変えて。"
          : examType === "mc" ? "4択問題を1問だけ出して。選択肢はA〜Dの4つ。"
          : examType === "tf" ? "正誤問題（True/False）を1問だけ出して。「正しい」か「誤り」かを答えさせる形式で。"
          : examType === "fill" ? "空欄補充問題を1問だけ出して。文中の重要語句を空欄にして、答えを入れさせる形式で。"
          : "記述問題を1問だけ出して。概念の説明や理由を数文で述べさせる形式で。";
        return toSuperscript(pp + ctx + "\n\n---\n【大学試験レベルの問題を1問出して】\n" + examInstr + "\n\n【ルール】\n・問題だけ先に出すこと。答えはまだ出さない。\n・「答え合わせして」と言われたら正解と解説を教えて。\n・問題の難易度は大学の定期試験レベルで。");
      }
      if (kind === "summary") return toSuperscript(pp + ctx + "\n\n---\n【重点（試験直前まとめ）を作って】\n以下の構成で、この資料の内容を試験直前に見返せる形にまとめて。\n\n① 重要概念・用語（定義を簡潔に）\n② 重要な公式・法則・関係（あれば）\n③ よく問われるポイント・ひっかけ注意点\n④ 全体の流れ・構造の一言まとめ\n\n箇条書きを中心に、見やすく簡潔にまとめること。");
      return toSuperscript(pp + ctx);
    }
    const head = "あなたは大学の「" + subject.name + "」のチューターです。以下の講義資料に基づいて教えてください。専門用語は丁寧に、正確さを保って。\n\n";
    const instr = subject.formatInstr || {};
    if (kind === "quiz") {
      const f = subject.formats ? (instr[fmt] || instr.mix || "") : "";
      if (subject.formats) {
        const common = "この資料から、" + f + "復習問題を" + cnt + "問つくってください。\n【重要なルール】\n・答えと解説は最初に出さず、まず問題だけ出してください。\n・「答え合わせして」と言われたら解説してください。" + reviewFmt;
        if (mode === "oneByOne") return toSuperscript(head + ctx + "\n\n---\n" + common + "\n\n【進め方：1問ずつ】\n・まず" + cnt + "問の一覧を見せてください（問題文だけ）。指定された番号から出してOK。全問終わったら復習リスト用フォーマットで出してください。");
        return toSuperscript(head + ctx + "\n\n---\n" + common + "\n\n【進め方：まとめて出題】\n・" + cnt + "問を番号付きで一気に出してください（問題文だけ）。「答え合わせして」で全問の解説。解説のあと復習リスト用フォーマットで出してください。");
      }
      return toSuperscript(head + ctx + "\n\n---\nこの資料から復習問題を5問出してください。各問に答えと簡単な解説もつけてください。");
    }
    if (kind === "lecture") return toSuperscript(head + ctx + "\n\n---\nこの資料の要点を、初学者向けに簡単な講義形式で説明してください。");
    if (kind === "cards") return toSuperscript(head + ctx + "\n\n---\nこの資料から暗記カードを10枚作ってください。「Q: 〜 / A: 〜」の形式で出力してください。");
    if (kind === "exam") {
      const examInstr = examType === "random"
        ? "4択・正誤（T/F）・空欄補充・記述のどれかをランダムに1問だけ出してください。形式は毎回変えてください。"
        : examType === "mc" ? "4択問題を1問だけ出してください。選択肢はA〜Dの4つ。"
        : examType === "tf" ? "正誤問題（True/False）を1問だけ出してください。「正しい」か「誤り」かを答えさせる形式で。"
        : examType === "fill" ? "空欄補充問題を1問だけ出してください。文中の重要語句を空欄にして、答えを入れさせる形式で。"
        : "記述問題を1問だけ出してください。概念の説明や理由を数文で述べさせる形式で。";
      return toSuperscript(head + ctx + "\n\n---\n【大学試験レベルの問題を1問出してください】\n" + examInstr + "\n\n【ルール】\n・問題だけ先に出すこと。答えはまだ出さないでください。\n・「答え合わせして」と言われたら正解と解説を教えてください。\n・問題の難易度は大学の定期試験レベルで。");
    }
    if (kind === "summary") return toSuperscript(head + ctx + "\n\n---\n【重点（試験直前まとめ）を作ってください】\n以下の構成で、この資料の内容を試験直前に見返せる形にまとめてください。\n\n① 重要概念・用語（定義を簡潔に）\n② 重要な公式・法則・関係（あれば）\n③ よく問われるポイント・ひっかけ注意点\n④ 全体の流れ・構造の一言まとめ\n\n箇条書きを中心に、見やすく簡潔にまとめること。");
    return toSuperscript(head + ctx);
  }

  function instrOnly() {
    const instr = subject.formatInstr || {};
    const f = instr[fmt] || instr.mix || "";
    const base = "さっきの資料をもとに、" + f + "復習問題を" + cnt + "問つくって。答えと解説は最初に出さず、まず問題だけ出してね。「答え合わせして」で解説して。";
    if (mode === "oneByOne") return toSuperscript(base + "\n1問ずつ対話で。まず一覧（問題文だけ）を見せて、指定した順でOK。「次」は未回答から。" + reviewFmt);
    return toSuperscript(base + "\n" + cnt + "問まとめて出して、「答え合わせして」で解説。" + reviewFmt);
  }
  function docsOnly() { return "以下の資料も参考にして（さっきまでの会話の続きで、追加の教材です）：\n\n" + ctxText(); }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      <div style={{ background: "#fff", border: "1.5px solid " + subject.accent + "33", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Sparkles size={17} style={{ color: subject.accent }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Claudeに考えてもらう</div>
        </div>
        <p style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, margin: "0 0 12px" }}>
          ①のフルプロンプトを新チャットに貼ってチューターを起動 → 追加の問題は②で足す。{subject.persona ? "チューター「" + subject.persona + "」の人格で答えるよ。" : ""}重くなったら新チャットに切り替え（①から）。
        </p>
        {docs.length === 0 ? <p style={{ fontSize: 13, color: "#bbb", margin: 0 }}>まず資料をアップロードしてね。</p> : (
          <React.Fragment>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: pickedN ? subject.accent : "#888" }}>{pickedN ? pickedN + "件の資料を対象" : "全" + docs.length + "件を対象"}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: heavy ? "#c0392b" : "#aaa" }}>約{chars.toLocaleString()}字{heavy ? " ⚠️" : ""}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={selAll} disabled={allSel} style={{ ...S.chip, cursor: allSel ? "default" : "pointer", fontSize: 11.5, opacity: allSel ? 0.5 : 1 }}>全選択</button>
                <button onClick={clrAll} disabled={!pickedN} style={{ ...S.chip, cursor: pickedN ? "pointer" : "default", fontSize: 11.5, opacity: pickedN ? 1 : 0.5 }}>選択解除</button>
              </div>
            </div>
            {heavy && <div style={{ fontSize: 11.5, color: "#c0392b", background: "#c0392b0d", borderRadius: 8, padding: "8px 11px", marginBottom: 11, lineHeight: 1.6 }}>⚠️ プロンプトが長いよ（約{chars.toLocaleString()}字）。範囲を絞るのがおすすめ！</div>}
            {subject.formats && (
              <div style={{ background: "#faf9f6", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#888", marginBottom: 7 }}>📝 復習問題の形式</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {subject.formats.map(f => {
                    const on = fmt === f.id;
                    return <button key={f.id} onClick={() => setFmt(f.id)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", border: "1px solid " + (on ? subject.accent : "#ddd"), background: on ? subject.accent : "#fff", color: on ? "#fff" : "#555" }}>{f.label}</button>;
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#888", marginBottom: 7 }}>進め方</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[["batch", "まとめて出題"], ["oneByOne", "1問ずつ対話"]].map(([v, l]) => (
                        <button key={v} onClick={() => setMode(v)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: mode === v ? 700 : 500, cursor: "pointer", border: "1px solid " + (mode === v ? subject.accent : "#ddd"), background: mode === v ? subject.accent : "#fff", color: mode === v ? "#fff" : "#555" }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#888", marginBottom: 7 }}>問題数</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[3, 5, 10].map(n => (
                        <button key={n} onClick={() => setCnt(n)} style={{ padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: cnt === n ? 700 : 500, cursor: "pointer", border: "1px solid " + (cnt === n ? subject.accent : "#ddd"), background: cnt === n ? subject.accent : "#fff", color: cnt === n ? "#fff" : "#555" }}>{n}問</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", marginBottom: 7 }}>① 新しいチャットの最初に貼る{subject.persona ? "（人格＋資料＋指示）" : "（資料＋指示）"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <CopyBtn text={makePrompt("quiz")} label="復習問題（フル）" style={S.pBtn(subject.accent)} />
              <CopyBtn text={makePrompt("lecture")} label="ミニ講義（フル）" style={S.pBtn(subject.accent)} />
              <CopyBtn text={makePrompt("cards")} label="カード生成（フル）" style={S.pBtn(subject.accent)} />
              <CopyBtn text={makePrompt("ctx")} label={subject.persona ? "人格＋資料だけ" : "資料だけ"} style={S.btn(subject.accent)} />
            </div>
            <div style={{ background: "#faf9f6", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#888", marginBottom: 8 }}>🎓 試験形式（1問）</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {[["mc","4択"],["tf","正誤T/F"],["fill","空欄補充"],["essay","記述"],["random","ランダム"]].map(([v,l]) => (
                  <button key={v} onClick={() => setExamType(v)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: examType === v ? 700 : 500, cursor: "pointer", border: "1px solid " + (examType === v ? subject.accent : "#ddd"), background: examType === v ? subject.accent : "#fff", color: examType === v ? "#fff" : "#555" }}>{l}</button>
                ))}
              </div>
              <CopyBtn text={makePrompt("exam")} label="試験問題（フル）" style={S.pBtn(subject.accent)} />
            </div>
            <div style={{ marginBottom: subject.persona ? 14 : 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#888", marginBottom: 8 }}>📒 重点</div>
              <CopyBtn text={makePrompt("summary")} label="重点（フル）" style={S.pBtn(subject.accent)} />
            </div>
            {subject.persona && (
              <React.Fragment>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", marginBottom: 7 }}>② 同じチャットに追加で貼る（軽量）</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <CopyBtn text={instrOnly()} label="指示だけ追加" style={S.btn(subject.accent)} />
                  <CopyBtn text={docsOnly()} label="資料だけ追加" style={S.btn(subject.accent)} />
                </div>
              </React.Fragment>
            )}
          </React.Fragment>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#666", flex: 1, minWidth: 120 }}>保存された資料 {docs.length} 件{pickedN ? " ・ " + pickedN + "件選択中" : ""}</span>
        <button onClick={() => setShowPaste(v => !v)} style={{ ...S.chip, cursor: "pointer", color: subject.accent }}><ClipboardCopy size={14} /> テキスト貼り付け保存</button>
        <input ref={impRef} type="file" accept="application/json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) impData(e.target.files[0]); e.target.value = ""; }} />
        <button onClick={() => impRef.current && impRef.current.click()} style={{ ...S.chip, cursor: "pointer", color: subject.accent }}><UploadCloud size={14} /> インポート</button>
        <CopyBtn text={expData()} label="エクスポート(コピー)" style={S.btn(subject.accent)} />
      </div>
      <div style={{ fontSize: 12, color: "#999", lineHeight: 1.7, background: "#faf9f6", borderRadius: 10, padding: "11px 14px", marginBottom: 16 }}>
        PDFはブラウザ内で抽出（レート制限なし）。テキスト層がないPDFはGeminiで整形→「テキスト貼り付け保存」。データはブラウザのlocalStorageに自動保存される。
      </div>

      {showPaste && (
        <div style={{ background: "#fff", border: "1.5px solid " + subject.accent, borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>テキストを貼り付けて資料として保存</div>
          <input value={pName} onChange={e => setPName(e.target.value)} placeholder="資料名（例：統計学 第1回）" style={S.inp} />
          <textarea value={pText} onChange={e => setPText(e.target.value)} rows={8} placeholder="ここにテキストを貼り付け…" style={{ ...S.inp, resize: "vertical", fontFamily: "inherit", minHeight: 160 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowPaste(false); setPName(""); setPText(""); }} style={{ ...S.chip, cursor: "pointer" }}>キャンセル</button>
            <button onClick={() => {
              if (!pText.trim()) return;
              const nm = pName.trim() || "貼り付け資料 " + new Date().toLocaleDateString("ja-JP");
              setDocs(prev => [...prev, { id: Date.now() + Math.random(), name: nm, kind: "text", text: pText.trim(), date: new Date().toLocaleDateString("ja-JP"), hasImage: false, method: "貼り付け" }]);
              setShowPaste(false); setPName(""); setPText("");
            }} disabled={!pText.trim()} style={{ ...S.btn(subject.accent), background: subject.accent, color: "#fff", opacity: pText.trim() ? 1 : 0.5 }}>保存</button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div style={{ margin: "30px auto", textAlign: "center", color: "#bbb", maxWidth: 360 }}>
          <FileText size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>まだ資料がないよ。上の「資料をアップロード」からPDF・画像を入れてね。</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map(d => {
            const img = imgFor(d.id);
            return (
              <div key={d.id} style={{ background: "#fff", border: "1px solid " + (sel[d.id] ? subject.accent : "#e5e3dd"), borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={!!sel[d.id]} onChange={() => toggle(d.id)} style={{ accentColor: subject.accent, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                  <FileText size={16} style={{ color: subject.accent }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{d.date} ・ {d.kind.toUpperCase()} ・ 約{d.text.length}字 ・ {d.method}{d.hasImage ? (img ? " ・ 🖼 図あり" : " ・ 🖼 図あり(要再読込)") : ""}</div>
                  </div>
                  <CopyBtn text={d.text} label="本文コピー" />
                  <button onClick={() => setOpenDoc(p => ({ ...p, [d.id]: !p[d.id] }))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#999" }}>{openDoc[d.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                  <button onClick={() => { setDocs(prev => prev.filter(x => x.id !== d.id)); setSessionImgs(prev => prev.filter(im => im.docId !== d.id)); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c0392b" }}><Trash2 size={15} /></button>
                </div>
                {openDoc[d.id] && (
                  <div style={{ marginTop: 12 }}>
                    {img && img.kind === "image" && <img src={"data:" + img.mediaType + ";base64," + img.data} alt={d.name} style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 10, border: "1px solid #eee" }} />}
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: "#444", whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto", background: "#faf9f6", borderRadius: 8, padding: "10px 12px" }}>{d.text}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardsPane({ subject, cards, setCards, setStatus }) {
  const [flipped, setFlipped] = useState({});
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(""), [front, setFront] = useState(""), [back, setBack] = useState("");
  const shown = onlyUnknown ? cards.filter(c => !c.known) : cards;
  const knownN = cards.filter(c => c.known).length;

  function addOne() {
    if (!front.trim() || !back.trim()) return;
    setCards(prev => [{ id: Date.now() + Math.random(), front: front.trim(), back: back.trim(), known: false }, ...prev]);
    setFront(""); setBack("");
  }
  function addBulk() {
    const lines = bulk.split("\n").map(l => l.trim()).filter(Boolean);
    const newCards = []; let curQ = null;
    const strip = s => s.replace(/^(?:問題|設問|問)[\s:：.)、]*/i, "").trim();
    for (const line of lines) {
      if (/^[📋【\[]?\s*(?:復習リスト|貼り付け)/.test(line)) continue;
      const np = strip(line);
      const qm = np.match(/^(?:Q\s*\d*|Question\s*\d*|問\s*\d*|【\s*問題?\s*\d*\s*】)[\s:：.)、]*(.*)$/i);
      const am = line.match(/^(?:A\s*\d*|Answer|答|解答)[\s:：.)、]+(.*)$/i);
      if (am) { if (curQ != null) { newCards.push({ id: Date.now() + Math.random() + newCards.length, front: curQ.trim(), back: am[1].trim(), known: false }); curQ = null; } }
      else if (qm && /^(?:Q|Question|問|【)/i.test(np)) { if (curQ != null) newCards.push({ id: Date.now() + Math.random() + newCards.length, front: curQ.trim(), back: "", known: false }); curQ = qm[1]; }
      else if (curQ != null) curQ += " " + line;
    }
    if (curQ != null) newCards.push({ id: Date.now() + Math.random() + newCards.length, front: curQ.trim(), back: "", known: false });
    const valid = newCards.filter(c => c.front);
    if (!valid.length) { setStatus({ type: "error", text: "「Q: 〜」「A: 〜」の形式で貼ってね" }); setTimeout(() => setStatus(null), 3500); return; }
    setCards(prev => [...valid, ...prev]); setBulk(""); setAdding(false);
    setStatus({ type: "info", text: valid.length + "枚追加したよ" }); setTimeout(() => setStatus(null), 2500);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e3dd", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 10 }}>手動追加するか、Claudeに「Q:／A:」形式で作ってもらって貼り付け一括追加できるよ。</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setAdding(a => a === "one" ? false : "one")} style={{ ...S.chip, cursor: "pointer", color: subject.accent }}><Plus size={14} /> 1枚追加</button>
          <button onClick={() => setAdding(a => a === "bulk" ? false : "bulk")} style={{ ...S.chip, cursor: "pointer", color: subject.accent }}><ClipboardCopy size={14} /> 貼り付けで一括追加</button>
        </div>
        {adding === "one" && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={front} onChange={e => setFront(e.target.value)} placeholder="問い / 用語" style={S.inp} />
            <input value={back} onChange={e => setBack(e.target.value)} placeholder="答え / 説明" style={S.inp} />
            <button onClick={addOne} disabled={!front.trim() || !back.trim()} style={{ ...S.btn(subject.accent), background: subject.accent, color: "#fff", alignSelf: "flex-start", opacity: front.trim() && back.trim() ? 1 : 0.5 }}>追加</button>
          </div>
        )}
        {adding === "bulk" && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={6} placeholder={"Q: 〜\nA: 〜"} style={{ ...S.inp, resize: "vertical", fontFamily: "inherit" }} />
            <button onClick={addBulk} disabled={!bulk.trim()} style={{ ...S.btn(subject.accent), background: subject.accent, color: "#fff", alignSelf: "flex-start", opacity: bulk.trim() ? 1 : 0.5 }}>一括追加</button>
          </div>
        )}
      </div>
      {cards.length === 0 ? (
        <div style={{ margin: "40px auto", textAlign: "center", color: "#bbb", maxWidth: 360 }}>
          <Layers size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>まだカードがないよ。上から追加してね。</p>
        </div>
      ) : (
        <React.Fragment>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#666" }}>{knownN} / {cards.length} 枚 覚えた</span>
            <div style={{ flex: 1, height: 7, background: "#e8e6e0", borderRadius: 4, minWidth: 100, overflow: "hidden" }}>
              <div style={{ width: (cards.length ? (knownN / cards.length) * 100 : 0) + "%", height: "100%", background: subject.accent, transition: "width .3s" }} />
            </div>
            <button onClick={() => setOnlyUnknown(v => !v)} style={{ ...S.chip, cursor: "pointer", color: onlyUnknown ? "#fff" : "#444", background: onlyUnknown ? subject.accent : "#fff", border: "1px solid " + (onlyUnknown ? subject.accent : "#ddd") }}>未習得のみ</button>
            <ConfirmBtn label="全消去" onConfirm={() => setCards([])} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
            {shown.map(c => {
              const f = flipped[c.id];
              return (
                <div key={c.id} onClick={() => setFlipped(p => ({ ...p, [c.id]: !p[c.id] }))}
                  style={{ background: "#fff", border: "1px solid " + (c.known ? subject.accent : "#e5e3dd"), borderRadius: 12, padding: 16, cursor: "pointer", minHeight: 130, display: "flex", flexDirection: "column", boxShadow: "0 1px 3px #0000000a" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: f ? "#1f8a70" : subject.accent, letterSpacing: 1, marginBottom: 8 }}>{f ? "答え" : "問い"}</div>
                  <div style={{ flex: 1, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{f ? c.back : c.front}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid #f0eee8" }}>
                    <span style={{ fontSize: 11, color: "#bbb" }}>{f ? "タップで戻る" : "タップでめくる"}</span>
                    <button onClick={e => { e.stopPropagation(); setCards(prev => prev.map(x => x.id === c.id ? { ...x, known: !x.known } : x)); }} style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: c.known ? subject.accent : "#aaa" }}><Check size={13} /> {c.known ? "覚えた" : "まだ"}</button>
                  </div>
                </div>
              );
            })}
          </div>
          {shown.length === 0 && <p style={{ textAlign: "center", color: "#bbb", fontSize: 13, marginTop: 30 }}>未習得のカードはないよ。全部覚えたね！</p>}
        </React.Fragment>
      )}
    </div>
  );
}

function ReviewPane({ subject, review, setReview, setStatus }) {
  const [openR, setOpenR] = useState({});
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState(""), [a, setA] = useState(""), [bulk, setBulk] = useState("");

  function add() {
    if (!q.trim()) return;
    setReview(prev => [{ id: Date.now() + Math.random(), q: q.trim(), a: a.trim(), date: new Date().toLocaleDateString("ja-JP") }, ...prev]);
    setQ(""); setA(""); setAdding(false);
  }
  function addBulk() {
    const lines = bulk.split("\n").map(l => l.trim()).filter(Boolean);
    const items = []; let curQ = null;
    const strip = s => s.replace(/^(?:問題|設問|問)[\s:：.)、]*/i, "").trim();
    for (const line of lines) {
      if (/^[📋【\[]?\s*(?:復習リスト|貼り付け)/.test(line)) continue;
      const np = strip(line);
      const qm = np.match(/^(?:Q\s*\d*|Question\s*\d*|問\s*\d*|【\s*問題?\s*\d*\s*】)[\s:：.)、]*(.*)$/i);
      const am = line.match(/^(?:A\s*\d*|Answer|答|解答)[\s:：.)、]+(.*)$/i);
      if (am) { if (curQ != null) { items.push({ q: curQ.trim(), a: am[1].trim() }); curQ = null; } }
      else if (qm && /^(?:Q|Question|問|【)/i.test(np)) { if (curQ != null) items.push({ q: curQ.trim(), a: "" }); curQ = qm[1]; }
      else if (curQ != null) curQ += " " + line;
    }
    if (curQ != null) items.push({ q: curQ.trim(), a: "" });
    const valid = items.filter(x => x.q);
    if (!valid.length) { setStatus({ type: "error", text: "「Q1: 〜」「A: 〜」の形で貼ってね" }); setTimeout(() => setStatus(null), 3500); return; }
    setReview(prev => [...valid.map((x, i) => ({ id: Date.now() + Math.random() + i, q: x.q, a: x.a, date: new Date().toLocaleDateString("ja-JP") })), ...prev]);
    setBulk(""); setAdding(false);
    setStatus({ type: "info", text: valid.length + "問追加したよ" }); setTimeout(() => setStatus(null), 2500);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e3dd", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 10 }}>間違えた問題を貯めよう。チューターの答え合わせ後の「📋 復習リスト貼り付け用」をコピーして一括追加できるよ。</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setAdding(v => v === "one" ? false : "one")} style={{ ...S.chip, cursor: "pointer", color: subject.accent }}><Plus size={14} /> 1問追加</button>
          <button onClick={() => setAdding(v => v === "bulk" ? false : "bulk")} style={{ ...S.chip, cursor: "pointer", color: subject.accent }}><ClipboardCopy size={14} /> 貼り付けで一括追加</button>
        </div>
        {adding === "one" && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea value={q} onChange={e => setQ(e.target.value)} rows={2} placeholder="間違えた問題（問い）" style={{ ...S.inp, resize: "vertical", fontFamily: "inherit" }} />
            <textarea value={a} onChange={e => setA(e.target.value)} rows={2} placeholder="正解・解説（任意）" style={{ ...S.inp, resize: "vertical", fontFamily: "inherit" }} />
            <button onClick={add} disabled={!q.trim()} style={{ ...S.btn(subject.accent), background: subject.accent, color: "#fff", alignSelf: "flex-start", opacity: q.trim() ? 1 : 0.5 }}>追加</button>
          </div>
        )}
        {adding === "bulk" && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={6} placeholder={"Q1: 問題文\nA: 答え\nQ2: …"} style={{ ...S.inp, resize: "vertical", fontFamily: "inherit" }} />
            <button onClick={addBulk} disabled={!bulk.trim()} style={{ ...S.btn(subject.accent), background: subject.accent, color: "#fff", alignSelf: "flex-start", opacity: bulk.trim() ? 1 : 0.5 }}>一括追加</button>
          </div>
        )}
      </div>
      {review.length === 0 ? (
        <div style={{ margin: "40px auto", textAlign: "center", color: "#bbb", maxWidth: 360 }}>
          <AlertCircle size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>間違えた問題はまだないよ。上から貯めていこう。</p>
        </div>
      ) : (
        <React.Fragment>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "#666", flex: 1 }}>{review.length} 問の苦手をストック中</span>
            <ConfirmBtn label="全消去" onConfirm={() => setReview([])} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {review.map(item => (
              <div key={item.id} style={{ background: "#fff", border: "1px solid #e5e3dd", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, lineHeight: 1.6, fontWeight: 500, whiteSpace: "pre-wrap" }}>{item.q}</div>
                    {item.a && (
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => setOpenR(p => ({ ...p, [item.id]: !p[item.id] }))} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, color: subject.accent, fontWeight: 600, padding: 0 }}>{openR[item.id] ? "解答を隠す" : "解答を見る"}</button>
                        {openR[item.id] && <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.65, color: "#555", whiteSpace: "pre-wrap", background: "#faf9f6", borderRadius: 8, padding: "9px 12px" }}>{item.a}</div>}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 8 }}>{item.date} 追加</div>
                  </div>
                  <button onClick={() => setReview(prev => prev.filter(x => x.id !== item.id))} style={{ ...S.chip, cursor: "pointer", color: "#1f8a70" }}><Check size={13} /> 克服</button>
                </div>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}
