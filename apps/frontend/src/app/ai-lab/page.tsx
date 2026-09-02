"use client";

import React, { useState, useEffect } from "react";
import { Mic, MicOff, MessageSquare, AlertCircle, ArrowLeft, Send, Play, Sparkles, Check, X } from "lucide-react";
import Link from "next/link";

import { useSpatialWebSocket } from "../../hooks/useSpatialWebSocket";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export default function AILabWorkspacePage() {
  const { dbSessionId } = useSpatialWebSocket();

  // Chat conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Voice Speech states
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<"IDLE" | "LISTENING" | "ERROR" | "NOT_SUPPORTED">("IDLE");
  const [voiceErrorMsg, setVoiceErrorMsg] = useState("");

  // Context mock boundaries (AIRSPACE context)
  const [activeModule, setActiveModule] = useState<"CANVAS" | "MATH">("CANVAS");
  const [canvasObjectsCount, setCanvasObjectsCount] = useState(3);
  const [selectedObjectType, setSelectedObjectType] = useState<string | null>("RECTANGLE");

  // Safety confirm modal
  const [confirmCommand, setConfirmCommand] = useState<{
    type: string;
    description: string;
    action: () => void;
  } | null>(null);

  // Send Query to AI router
  const sendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    
    // Append user query to chat history
    const userMsg: Message = {
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/ai-lab/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_session_id: dbSessionId || 0,
          query: queryText,
          context: {
            current_module: activeModule,
            selected_object: selectedObjectType 
              ? { type: selectedObjectType, color: "#3b82f6", width: 4 } 
              : null,
            canvas_objects: Array.from({ length: canvasObjectsCount }).map((_, i) => ({
              id: `stroke-${i}`,
              type: i === 0 && selectedObjectType ? selectedObjectType : "STROKE"
            }))
          }
        })
      });

      if (!response.ok) throw new Error("AI query failure");
      const result = await response.json();

      // Check if command is potentially destructive (e.g. CLEAR)
      if (result.intent === "CLEAR" && result.action === "execute_command") {
        setConfirmCommand({
          type: "CLEAR",
          description: "This command will delete all drawing vector layers on your canvas. Are you sure?",
          action: () => {
            setCanvasObjectsCount(0);
            setSelectedObjectType(null);
            
            const assistMsg: Message = {
              role: "assistant",
              content: "Canvas cleared successfully.",
              timestamp: new Date().toLocaleTimeString()
            };
            setMessages((prev) => [...prev, assistMsg]);
            setConfirmCommand(null);
          }
        });
      } 
      else if (result.action === "execute_tool") {
        const assistMsg: Message = {
          role: "assistant",
          content: `[Tool: ${result.tool}] ${result.response}`,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages((prev) => [...prev, assistMsg]);
      }
      else {
        const assistantMsg: Message = {
          role: result.llm_status === "not_configured" ? "system" : "assistant",
          content: result.response || "No response received.",
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (e) {
      console.error(e);
      const errMsg: Message = {
        role: "system",
        content: "Error reaching AI reasoning assistant. Make sure backend is running.",
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Browser speech recognition loop
  const handleStartVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("NOT_SUPPORTED");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setVoiceStatus("LISTENING");
        setVoiceErrorMsg("");
      };

      rec.onerror = (e: any) => {
        setVoiceStatus("ERROR");
        setVoiceErrorMsg(e.error === "not-allowed" ? "Permission denied" : e.error);
      };

      rec.onend = () => {
        setVoiceStatus("IDLE");
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceTranscript(transcript);
        sendQuery(transcript);
      };

      rec.start();
    } catch (e: any) {
      setVoiceStatus("ERROR");
      setVoiceErrorMsg(e.message || "Failed to start recognition");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white flex items-center gap-2">
              AI LAB
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">REASONING CORE</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">Central Multimodal Workspace of AIRSPACE</p>
          </div>
        </div>
      </header>

      {/* Main Grid Panel */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Left Column: Context Aggregator panel (ColSpan: 3) */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Interaction Context</h2>
          <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-xl flex flex-col gap-4 text-xs font-mono">
            <div className="flex flex-col gap-2 pb-3 border-b border-gray-800/80">
              <span className="text-gray-500 uppercase text-[9px]">Active Module:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveModule("CANVAS")}
                  className={`px-3 py-1 rounded border ${
                    activeModule === "CANVAS"
                      ? "bg-blue-950/60 border-blue-800 text-blue-400"
                      : "bg-gray-950 border-gray-900 text-gray-500"
                  }`}
                >
                  Canvas
                </button>
                <button
                  onClick={() => setActiveModule("MATH")}
                  className={`px-3 py-1 rounded border ${
                    activeModule === "MATH"
                      ? "bg-purple-950/60 border-purple-800 text-purple-400"
                      : "bg-gray-950 border-gray-900 text-gray-500"
                  }`}
                >
                  Math
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-gray-500 uppercase text-[9px]">Context parameters:</span>
              <div className="space-y-1.5 text-gray-400 text-[10px]">
                <div className="flex justify-between">
                  <span>Selected Object:</span>
                  <span className="text-white font-bold">{selectedObjectType || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Canvas Shapes:</span>
                  <span className="text-white font-bold">{canvasObjectsCount} objects</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-800/50">
                <button
                  onClick={() => {
                    setSelectedObjectType(selectedObjectType ? null : "RECTANGLE");
                  }}
                  className="px-2 py-1 rounded bg-gray-950 hover:bg-gray-900 border border-gray-900 text-[9px] font-semibold text-gray-300 transition"
                >
                  Toggle Select
                </button>
                <button
                  onClick={() => setCanvasObjectsCount((prev) => prev + 1)}
                  className="px-2 py-1 rounded bg-gray-950 hover:bg-gray-900 border border-gray-900 text-[9px] font-semibold text-gray-300 transition"
                >
                  Add Shape
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Chat dialogue panel (ColSpan: 6) */}
        <div className="lg:col-span-6 flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Conversational reasoning</h2>
          
          <div className="flex-1 min-h-[350px] md:min-h-[400px] rounded-xl bg-[#0f172a] border border-gray-800 flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Safety modal overlay */}
            {confirmCommand && (
              <div className="absolute inset-0 bg-gray-950/80 z-20 flex items-center justify-center p-6 backdrop-blur-sm">
                <div className="max-w-md w-full rounded-xl bg-gray-900 border border-red-900/40 p-6 flex flex-col gap-4 text-xs">
                  <div className="flex items-center gap-2 text-red-400 font-bold">
                    <AlertCircle className="h-5 w-5" />
                    Destructive Action Pending
                  </div>
                  <p className="text-gray-300 leading-relaxed">{confirmCommand.description}</p>
                  <div className="flex gap-3 justify-end mt-2">
                    <button
                      onClick={() => setConfirmCommand(null)}
                      className="px-3 py-1.5 rounded bg-gray-950 hover:bg-gray-800 border border-gray-800 text-[10px] font-semibold text-gray-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmCommand.action}
                      className="px-3 py-1.5 rounded bg-red-950 hover:bg-red-900 border border-red-800 text-[10px] font-semibold text-red-400 transition"
                    >
                      Proceed
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages box */}
            <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[320px] md:max-h-[360px]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 h-full text-gray-500 py-10">
                  <Sparkles className="h-8 w-8 text-gray-600 animate-pulse" />
                  <p className="text-xs italic">Ask context-aware questions (e.g. &quot;Explain this diagram&quot;) or use Voice Commands...</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[80%] ${
                      msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    <span className="text-[8px] font-mono text-gray-500 pb-1">{msg.timestamp}</span>
                    <div
                      className={`p-3 rounded-xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-none"
                          : msg.role === "system"
                            ? "bg-red-950/40 border border-red-900/30 text-red-400 rounded-bl-none"
                            : "bg-gray-950 border border-gray-900 text-gray-200 rounded-bl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Suggested quick commands */}
            <div className="px-4 py-2 bg-gray-950/30 border-t border-gray-850/50 flex flex-wrap gap-1.5">
              <span className="text-[9px] font-mono text-gray-500 mr-1 self-center">Commands:</span>
              <button
                onClick={() => sendQuery("Explain this")}
                className="px-2 py-0.5 rounded bg-gray-900 hover:bg-blue-600/30 border border-gray-800 text-[10px] text-gray-300 transition"
              >
                &quot;Explain this&quot;
              </button>
              <button
                onClick={() => sendQuery("Plot this")}
                className="px-2 py-0.5 rounded bg-gray-900 hover:bg-purple-600/30 border border-gray-800 text-[10px] text-gray-300 transition"
              >
                &quot;Plot this&quot;
              </button>
              <button
                onClick={() => sendQuery("Solve 2x + 5 = 15")}
                className="px-2 py-0.5 rounded bg-gray-900 hover:bg-emerald-600/30 border border-gray-800 text-[10px] text-gray-300 transition"
              >
                &quot;Solve 2x + 5 = 15&quot;
              </button>
            </div>

            {/* Text Input Footer */}
            <div className="border-t border-gray-800 p-4 bg-gray-950/50 flex gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendQuery(inputQuery)}
                placeholder="Ask AI Lab assistant..."
                className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
              <button
                onClick={() => sendQuery(inputQuery)}
                disabled={loading || !inputQuery.trim()}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition"
                aria-label="Send Query"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Voice Commands & Transcription (ColSpan: 3) */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Voice Input</h2>
          <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-xl flex flex-col items-center justify-center gap-4 text-center">
            
            <button
              onClick={handleStartVoice}
              disabled={voiceStatus === "LISTENING"}
              className={`p-6 rounded-full border shadow-lg transition duration-200 ${
                voiceStatus === "LISTENING"
                  ? "bg-red-950/50 border-red-800 text-red-400 animate-pulse"
                  : "bg-gray-950 hover:bg-gray-900 border-gray-800 text-gray-400"
              }`}
              aria-label="Speech command button"
            >
              {voiceStatus === "LISTENING" ? (
                <Mic className="h-8 w-8 text-red-500" />
              ) : (
                <MicOff className="h-8 w-8 text-gray-500" />
              )}
            </button>

            <div className="text-xs font-mono">
              <span className="text-[9px] uppercase text-gray-500 block pb-1">Microphone Status:</span>
              {voiceStatus === "LISTENING" ? (
                <span className="text-red-400 font-bold animate-pulse">LISTENING...</span>
              ) : voiceStatus === "NOT_SUPPORTED" ? (
                <span className="text-yellow-500 font-semibold">WebSpeech not supported</span>
              ) : voiceStatus === "ERROR" ? (
                <span className="text-red-500 font-semibold">Error: {voiceErrorMsg}</span>
              ) : (
                <span className="text-gray-500">Idle / Tap to Speak</span>
              )}
            </div>

            {voiceTranscript && (
              <div className="w-full text-left p-3 rounded bg-gray-950/60 border border-gray-900 text-[10px] font-mono text-gray-400 mt-2">
                <span className="text-[8px] uppercase text-gray-500 block pb-1">Last Transcript:</span>
                &quot;{voiceTranscript}&quot;
              </div>
            )}

          </div>
        </div>

      </main>
    </div>
  );
}
export type AILabWorkspacePageType = typeof AILabWorkspacePage;
