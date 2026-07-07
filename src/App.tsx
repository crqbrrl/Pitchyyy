import { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Send, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Lightbulb,
  ArrowRight,
  Loader2,
  Quote,
  Image as ImageIcon,
  Upload,
  History,
  Trash2,
  X,
  ChevronRight
} from "lucide-react";
import { analyzePitch, extractPitchFromImage, type VCReaction } from "./lib/gemini";
import { cn } from "./lib/utils";

interface PitchHistoryItem {
  id: string;
  vcName: string;
  pitch: string;
  reaction: VCReaction;
  timestamp: number;
}

export default function App() {
  const [vcName, setVcName] = useState("");
  const [pitch, setPitch] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<VCReaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Researching VC...");
  const [history, setHistory] = useState<PitchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem("pitchyyy_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = (vc: string, p: string, reaction: VCReaction) => {
    const newItem: PitchHistoryItem = {
      id: crypto.randomUUID(),
      vcName: vc,
      pitch: p,
      reaction,
      timestamp: Date.now()
    };
    const updatedHistory = [newItem, ...history].slice(0, 20); // Keep last 20
    setHistory(updatedHistory);
    localStorage.setItem("pitchyyy_history", JSON.stringify(updatedHistory));
  };

  const deleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem("pitchyyy_history", JSON.stringify(updatedHistory));
  };

  const loadingMessages = [
    "Analyzing investment thesis...",
    "Scanning portfolio companies...",
    "Checking recent public statements...",
    "Reviewing investment patterns...",
    "Simulating VC reaction...",
    "Formulating tough questions...",
    "Finalizing verdict..."
  ];

  const handleAnalyze = async () => {
    if (!vcName || !pitch) return;
    
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      setLoadingMessage(loadingMessages[messageIndex % loadingMessages.length]);
      messageIndex++;
    }, 2500);
    
    try {
      const reaction = await analyzePitch(vcName, pitch);
      setResult(reaction);
      saveToHistory(vcName, pitch, reaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsAnalyzing(false);
      clearInterval(messageInterval);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const extractedPitch = await extractPitchFromImage(base64, file.type);
        setPitch(extractedPitch);
      } catch (err) {
        setError("Failed to extract pitch from image. Please try typing it.");
      } finally {
        setIsExtracting(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read the image file. Please try again.");
      setIsExtracting(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Pitchyyy</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <div className="text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded uppercase tracking-wider hidden sm:block">
              VC Prediction Engine
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-12">
        <AnimatePresence>
          {showHistory && (
            <motion.div 
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-[60] p-6 overflow-y-auto border-l border-zinc-200"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-display font-bold">Pitch History</h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-20 text-zinc-400">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No history yet. Start pitching!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-4 border border-zinc-100 rounded-2xl hover:border-zinc-300 transition-all cursor-pointer group"
                      onClick={() => {
                        setVcName(item.vcName);
                        setPitch(item.pitch);
                        setResult(item.reaction);
                        setShowHistory(false);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-zinc-900">{item.vcName}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item.id);
                          }}
                          className="p-1 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-2 mb-3 break-words whitespace-normal">{item.pitch}</p>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                          item.reaction.verdict === "HARD PASS" && "bg-red-50 text-red-600",
                          item.reaction.verdict === "SKEPTICAL" && "bg-orange-50 text-orange-600",
                          item.reaction.verdict === "INTRIGUED" && "bg-blue-50 text-blue-600",
                          item.reaction.verdict === "EXCITED" && "bg-green-50 text-green-600",
                          item.reaction.verdict === "ALL IN" && "bg-zinc-900 text-white"
                        )}>
                          {item.reaction.verdict}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-bold text-zinc-900 mb-4 tracking-tight"
          >
            Know your investor <br />
            <span className="text-zinc-500">before the meeting.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-600 text-lg max-w-xl mx-auto"
          >
            Name a VC and drop your pitch or upload a slide. I'll tell you exactly what they'd think.
          </motion.p>
        </div>

        {/* Input Section */}
        <div className="space-y-6 mb-12">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-700 ml-1">Which VC are you pitching?</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                type="text"
                placeholder="e.g. Marc Andreessen, Michael Seibel, Sequoia Capital..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all text-lg shadow-sm"
                value={vcName}
                onChange={(e) => setVcName(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2 ml-1">
              {["Marc Andreessen", "Michael Seibel", "Naval Ravikant", "Sequoia Capital"].map(name => (
                <button 
                  key={name}
                  onClick={() => setVcName(name)}
                  className="text-sm font-medium bg-zinc-100 text-zinc-600 px-3 py-1.5 rounded-md hover:bg-zinc-200 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-sm font-semibold text-zinc-700">Your Pitch</label>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                Upload Slide Screenshot
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload}
              />
            </div>
            
            <div className="relative">
              <textarea 
                placeholder="Paste your elevator pitch, problem statement, and solution here..."
                className={cn(
                  "w-full p-6 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all text-lg min-h-[200px] shadow-sm resize-none",
                  isExtracting && "opacity-50 pointer-events-none"
                )}
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
              />
              {isExtracting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm rounded-2xl">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-900 mb-2" />
                  <p className="text-sm font-bold text-zinc-900">Analyzing slide...</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !vcName || !pitch}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg",
                isAnalyzing || !vcName || !pitch
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]"
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {loadingMessage}
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Analyze Reaction
                </>
              )}
            </button>
            
            {(vcName || pitch) && !isAnalyzing && (
              <button
                onClick={() => {
                  setVcName("");
                  setPitch("");
                  setResult(null);
                  setError(null);
                }}
                className="px-6 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 transition-all"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 mb-8"
            >
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12 mt-12"
            >
              <div className="p-10 md:p-14 bg-white border border-zinc-200 rounded-[2.5rem] shadow-2xl space-y-16">
                {/* Verdict Header - Centered */}
                <div className="text-center space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">The Verdict</h3>
                    <h2 className="text-3xl md:text-4xl font-display font-bold text-zinc-900">
                      {result.vcName}'s Reaction
                    </h2>
                  </div>
                  
                  <div className="flex flex-col items-center gap-4">
                    <span className={cn(
                      "px-8 py-3 rounded-full text-base font-bold uppercase tracking-widest shadow-sm",
                      result.verdict === "HARD PASS" && "bg-red-50 text-red-600 border border-red-100",
                      result.verdict === "SKEPTICAL" && "bg-orange-50 text-orange-600 border border-orange-100",
                      result.verdict === "INTRIGUED" && "bg-blue-50 text-blue-600 border border-blue-100",
                      result.verdict === "EXCITED" && "bg-green-50 text-green-600 border border-green-100",
                      result.verdict === "ALL IN" && "bg-zinc-900 text-white"
                    )}>
                      {result.verdict}
                    </span>
                    <p className="text-xl md:text-2xl text-zinc-600 font-medium italic max-w-2xl mx-auto leading-relaxed">
                      "{result.summary}"
                    </p>
                  </div>
                </div>

                {/* Priority Scores - Full Width Table Style */}
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-zinc-100" />
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-4">
                      <TrendingUp className="w-4 h-4" />
                      Priority Analysis
                    </h3>
                    <div className="h-px flex-1 bg-zinc-100" />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-8">
                    {result.scores.map((s, i) => (
                      <div key={i} className="group">
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-base font-semibold text-zinc-800">{s.label}</span>
                          <span className="text-lg font-bold text-zinc-900">{s.score}<span className="text-zinc-300 text-sm ml-0.5">/10</span></span>
                        </div>
                        <div className="h-3 bg-zinc-50 rounded-full overflow-hidden border border-zinc-100 p-0.5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${s.score * 10}%` }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.1 }}
                            className={cn(
                              "h-full rounded-full transition-colors",
                              s.score >= 8 ? "bg-zinc-900" : 
                              s.score >= 5 ? "bg-zinc-500" : "bg-zinc-300"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pros & Cons - Side by Side Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-green-50/30 border border-green-100 rounded-3xl space-y-5">
                    <h3 className="text-sm font-bold text-green-700 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      What they'd love
                    </h3>
                    <ul className="space-y-4">
                      {result.pros.map((p, i) => (
                        <li key={i} className="text-[15px] text-zinc-700 leading-relaxed flex gap-3">
                          <span className="text-green-500 font-bold shrink-0 mt-0.5">✓</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-8 bg-red-50/30 border border-red-100 rounded-3xl space-y-5">
                    <h3 className="text-sm font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      What they'd push back on
                    </h3>
                    <ul className="space-y-4">
                      {result.cons.map((c, i) => (
                        <li key={i} className="text-[15px] text-zinc-700 leading-relaxed flex gap-3">
                          <span className="text-red-500 font-bold shrink-0 mt-0.5">!</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Tough Question - Highlighted Box */}
                <div className="relative overflow-hidden bg-zinc-900 text-white p-10 md:p-12 rounded-[2rem] shadow-xl">
                  <Quote className="absolute -top-4 -left-4 w-24 h-24 text-white/5 rotate-180" />
                  <div className="relative z-10 space-y-6">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" />
                      The Toughest Question
                    </h3>
                    <p className="text-2xl md:text-3xl font-display font-medium italic leading-tight">
                      "{result.toughQuestion}"
                    </p>
                  </div>
                </div>

                {/* Tailoring Tips - Numbered List */}
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-zinc-100" />
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest flex items-center gap-2 px-4">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      Strategic Adjustments
                    </h3>
                    <div className="h-px flex-1 bg-zinc-100" />
                  </div>
                  
                  <div className="space-y-4">
                    {result.tailoringTips.map((tip, i) => (
                      <div key={i} className="group p-6 bg-white border border-zinc-100 rounded-2xl flex gap-5 items-start transition-all hover:border-zinc-200 hover:shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-md">
                          {i + 1}
                        </div>
                        <p className="text-[15px] text-zinc-700 leading-relaxed pt-2 break-words whitespace-normal">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-4">
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98]"
                  >
                    Refine Pitch & Try Again
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Footer Info */}
        {!result && !isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-5 h-5 text-zinc-500" />
              </div>
              <h4 className="font-bold text-sm">Real-time Research</h4>
              <p className="text-sm text-zinc-500">We crawl tweets, blogs, and portfolios to understand their current mindset.</p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-5 h-5 text-zinc-500" />
              </div>
              <h4 className="font-bold text-sm">Specific Criteria</h4>
              <p className="text-sm text-zinc-500">No generic feedback. We score you on what THAT specific VC actually cares about.</p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="w-5 h-5 text-zinc-500" />
              </div>
              <h4 className="font-bold text-sm">Actionable Tips</h4>
              <p className="text-sm text-zinc-500">Get 2-3 specific changes to make your pitch land better with the investor.</p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

