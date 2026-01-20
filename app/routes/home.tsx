import { useState, useCallback, useRef, useEffect } from "react";
import type { Route } from "./+types/home";
import {
  Play,
  Pause,
  Square,
  Copy,
  Check,
  Activity,
  Clock,
  Link as LinkIcon,
  FileText,
  User,
  Users,
  RotateCcw,
  Timer
} from "lucide-react";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Status Updater" },
    { name: "description", content: "Generate quick status updates" },
  ];
}

type StatusType = "START" | "PAUSE" | "STOP";
type UserType = "dev" | "qa";
type TimerState = "idle" | "running" | "paused" | "stopped";

interface FormData {
  project: string;
  task: string;
  dev: string;
  // START fields
  estimatedHours: string;
  estimatedMinutes: string;
  reference: string;
  // PAUSE fields
  pauseStatus: string;
  pauseReason: string;
  progress: string;
  // STOP fields
  stopStatus: string;
  customStopStatus: string;
  timeTakenHours: string;
  timeTakenMinutes: string;
  notes: string;
}

const initialFormData: FormData = {
  project: "",
  task: "",
  dev: "",
  estimatedHours: "",
  estimatedMinutes: "",
  reference: "",
  pauseStatus: "In Progress",
  pauseReason: "",
  progress: "",
  stopStatus: "Moved to QA",
  customStopStatus: "",
  timeTakenHours: "",
  timeTakenMinutes: "",
  notes: "",
};

const STATUS_CONFIG = {
  START: {
    icon: Play,
    label: "START",
  },
  PAUSE: {
    icon: Pause,
    label: "PAUSE",
  },
  STOP: {
    icon: Square,
    label: "STOP",
  },
};

export default function Home() {
  const [statusType, setStatusType] = useState<StatusType>("START");
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [copied, setCopied] = useState(false);
  const [userType, setUserType] = useState<UserType>("dev");

  // Timer state
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [finalTime, setFinalTime] = useState<string | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Format seconds to HH:MM:SS
  const formatTime = useCallback((totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Timer controls
  const startTimer = useCallback(() => {
    if (timerState === "idle" || timerState === "stopped") {
      setTimerSeconds(0);
      setFinalTime(null);
    }
    setTimerState("running");
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
  }, [timerState]);

  const pauseTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerState("paused");
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const timeString = formatTime(timerSeconds);
    setFinalTime(timeString);
    setTimerState("stopped");

    // Auto-fill the timeTaken fields with the stopped time
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    setFormData((prev) => ({
      ...prev,
      timeTakenHours: hours.toString(),
      timeTakenMinutes: minutes.toString(),
    }));
  }, [timerSeconds, formatTime]);

  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerSeconds(0);
    setFinalTime(null);
    setTimerState("idle");
  }, []);

  // Format seconds to human-readable format (e.g., "2h 30m" or "45m")
  const formatTimeHuman = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${totalSeconds}s`;
  };

  // Format hours and minutes to decimal hours (e.g., "2.5h")
  const formatDecimalHours = (hours: string, minutes: string, prefix: string = "~", fallback: string = "<approx time spent>"): string => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    if (h === 0 && m === 0) return fallback;
    const decimalHours = h + m / 60;
    // Round to 1 decimal place, but only show decimal if needed
    const rounded = Math.round(decimalHours * 10) / 10;
    return `${prefix}${rounded}h`;
  };

  // Get the stop status (custom or predefined)
  const getStopStatus = (): string => {
    if (formData.stopStatus === "Custom") {
      return formData.customStopStatus || "<custom status>";
    }
    return formData.stopStatus;
  };

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const generateOutput = useCallback(() => {
    let output = "```\n";
    output += `${statusType}\n`;
    output += `Project: ${formData.project || "<brand name>"}\n`;
    output += `Task: ${formData.task || "<short description>"}\n`;

    if (statusType === "START") {
      const estimatedTime = formatDecimalHours(formData.estimatedHours, formData.estimatedMinutes, "~", "<e.g. 2h>");
      output += `Estimated Time: ${estimatedTime}\n`;
      output += `Reference: ${formData.reference || "nil"}\n`;
    } else if (statusType === "PAUSE") {
      output += `Status: ${formData.pauseStatus}\n`;
      output += `Reason: ${formData.pauseReason || "<short reason>"}\n`;
      output += `Progress: ${formData.progress || "<what is done so far>"}\n`;
    } else {
      // Format time taken as decimal hours
      const timeTaken = formatDecimalHours(formData.timeTakenHours, formData.timeTakenMinutes);

      output += `Status: ${getStopStatus()}\n`;
      output += `Time Taken: ${timeTaken}\n`;
      output += `Notes: ${formData.notes || "<build number>"}\n`;
    }

    const roleLabel = userType === "qa" ? "QA" : "Dev";
    output += `${roleLabel}: ${formData.dev || "<your name>"}\n`;
    output += "```";
    return output;
  }, [statusType, formData, userType]);

  const copyToClipboard = useCallback(async () => {
    try {
      const plainText = generateOutput();
      const htmlText = `<pre>${plainText.replace(/```/g, "").trim()}</pre>`;

      const clipboardItem = new ClipboardItem({
        "text/plain": new Blob([plainText], { type: "text/plain" }),
        "text/html": new Blob([htmlText], { type: "text/html" }),
      });

      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback to simple text copy if ClipboardItem fails (e.g. non-secure context)
      try {
        await navigator.clipboard.writeText(generateOutput());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
      }
    }
  }, [generateOutput]);

  const clearForm = useCallback(() => {
    setFormData(initialFormData);
  }, []);

  const handleTabChange = (type: StatusType) => {
    setStatusType(type);

  };

  const ConfigIcon = STATUS_CONFIG[statusType].icon;

  return (
    <div className="min-h-screen bg-[#020408] text-[#e0e0e0] font-sans selection:bg-[#7c4dff] selection:text-white overflow-x-hidden">
      {/* Antigravity / Lovable Style Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#4c1d95] rounded-full blur-[120px] opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#3b82f6] rounded-full blur-[100px] opacity-15"></div>
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-[#ec4899] rounded-full blur-[130px] opacity-10"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8">

        {/* Compact Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c4dff] to-[#3b82f6] flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Status Generator</h1>

            {/* User Type Toggle */}
            <div className="flex bg-[#0a0b10] border border-white/10 rounded-lg p-0.5 ml-4">
              <button
                onClick={() => setUserType("dev")}
                className={`
                  flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200
                  ${userType === "dev"
                    ? "bg-gradient-to-r from-[#7c4dff] to-[#6b3fd4] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-300"
                  }
                `}
              >
                <User className="w-3 h-3" />
                Dev
              </button>
              <button
                onClick={() => setUserType("qa")}
                className={`
                  flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200
                  ${userType === "qa"
                    ? "bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-300"
                  }
                `}
              >
                <Users className="w-3 h-3" />
                QA
              </button>
            </div>
          </div>

          <div className="flex bg-[#13141c] border border-white/5 rounded-lg p-1 shadow-inner">
            {(Object.keys(STATUS_CONFIG) as StatusType[]).map((type) => {
              const cfg = STATUS_CONFIG[type];
              const isActive = statusType === type;
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => handleTabChange(type)}
                  className={`
                    flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-200
                    ${isActive
                      ? "bg-[#252630] text-white shadow-sm ring-1 ring-white/10"
                      : "text-gray-400 hover:text-white hover:bg-[#1f2029]"
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-12 gap-6">

          {/* Form Section */}
          <div className="lg:col-span-7">
            <div className="bg-[#13141c]/80 backdrop-blur-xl rounded-xl border border-white/5 shadow-2xl p-5">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <ConfigIcon className="w-4 h-4 text-[#7c4dff]" />
                  <span>Task Details</span>
                </div>
                <button
                  onClick={clearForm}
                  className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-wider"
                >
                  Reset
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Project"
                    placeholder="Urban Space"
                    value={formData.project}
                    onChange={(v) => updateField("project", v)}
                  />
                  <InputField
                    label={userType === "qa" ? "QA Name" : "Dev Name"}
                    placeholder="Akash"
                    value={formData.dev}
                    onChange={(v) => updateField("dev", v)}
                  />
                </div>

                <InputField
                  label="Task"
                  placeholder="PDP – size guide popup implementation"
                  value={formData.task}
                  onChange={(v) => updateField("task", v)}
                />

                <div className="p-4 rounded-lg bg-[#0a0b10]/50 border border-white/5 space-y-4">
                  {statusType === "START" && (
                    <>
                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">
                            Estimated Time
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <InputField
                              label="Hours"
                              placeholder="2"
                              value={formData.estimatedHours}
                              onChange={(v) => updateField("estimatedHours", v.replace(/\D/g, ''))}
                            />
                            <InputField
                              label="Mins"
                              placeholder="30"
                              value={formData.estimatedMinutes}
                              onChange={(v) => updateField("estimatedMinutes", v.replace(/\D/g, ''))}
                            />
                          </div>
                        </div>
                        <InputField
                          label="Reference"
                          placeholder="Figma / Jira"
                          value={formData.reference}
                          onChange={(v) => updateField("reference", v)}
                          icon={<LinkIcon className="w-3.5 h-3.5" />}
                        />
                      </div>
                    </>
                  )}

                  {statusType === "PAUSE" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <SelectField
                          label="Status"
                          value={formData.pauseStatus}
                          onChange={(v) => updateField("pauseStatus", v)}
                          options={["In Progress", "Blocked"]}
                        />
                        <InputField
                          label="Reason"
                          placeholder="End of day..."
                          value={formData.pauseReason}
                          onChange={(v) => updateField("pauseReason", v)}
                        />
                      </div>
                      <InputField
                        label="Progress"
                        placeholder="Popup UI done..."
                        value={formData.progress}
                        onChange={(v) => updateField("progress", v)}
                      />
                    </>
                  )}

                  {statusType === "STOP" && (
                    <>
                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div>
                          <SelectField
                            label="Status"
                            value={formData.stopStatus}
                            onChange={(v) => updateField("stopStatus", v)}
                            options={["Done", "Moved to QA", "Dropped", "Re-scoped", "Custom"]}
                          />
                          {formData.stopStatus === "Custom" && (
                            <div className="mt-2">
                              <InputField
                                label="Custom Status"
                                placeholder="Enter custom status..."
                                value={formData.customStopStatus}
                                onChange={(v) => updateField("customStopStatus", v)}
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">
                            Time Taken
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <InputField
                              label="Hours"
                              placeholder="2"
                              value={formData.timeTakenHours}
                              onChange={(v) => updateField("timeTakenHours", v.replace(/\D/g, ''))}
                            />
                            <InputField
                              label="Mins"
                              placeholder="30"
                              value={formData.timeTakenMinutes}
                              onChange={(v) => updateField("timeTakenMinutes", v.replace(/\D/g, ''))}
                            />
                          </div>
                        </div>
                      </div>
                      <TextAreaField
                        label="Notes"
                        placeholder="Build 134..."
                        value={formData.notes}
                        onChange={(v) => updateField("notes", v)}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-5">
            <div className="bg-[#0a0b10] rounded-xl border border-white/5 shadow-2xl flex flex-col h-full sticky top-8">
              <div className="px-4 py-3 bg-[#13141c] border-b border-white/5 flex items-center justify-between rounded-t-xl">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[10px] font-mono text-gray-500 uppercase">Preview</span>
              </div>

              <div className="flex-1 p-4">
                <div className="font-mono text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
                  {generateOutput().replace(/```/g, "")}
                </div>
              </div>

              <div className="p-4 border-t border-white/5 bg-[#13141c]/50 rounded-b-xl">
                <button
                  onClick={copyToClipboard}
                  className={`
                    w-full py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-200
                    flex items-center justify-center gap-2
                    ${copied
                      ? "bg-[#28c840] text-white shadow-[0_0_15px_rgba(40,200,64,0.4)]"
                      : "bg-[#7c4dff] text-white hover:bg-[#6b3fd4] hover:shadow-[0_0_15px_rgba(124,77,255,0.4)]"
                    }
                  `}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Output
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Futuristic Timer Section */}
        <div className="mt-8">
          <div className="bg-[#0a0b10]/90 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl p-6 relative overflow-hidden">
            {/* Glowing background effects */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] transition-all duration-500 ${timerState === "running"
                  ? "bg-[#7c4dff] opacity-30 animate-pulse"
                  : timerState === "paused"
                    ? "bg-[#febc2e] opacity-20"
                    : timerState === "stopped"
                      ? "bg-[#28c840] opacity-25"
                      : "bg-[#3b82f6] opacity-10"
                  }`}
              />
            </div>

            <div className="relative z-10">
              {/* Timer Header */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <Timer className="w-5 h-5 text-[#7c4dff]" />
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Task Timer</span>
              </div>

              {/* Timer Display */}
              <div className="flex items-center justify-center mb-6">
                <div
                  className={`
                    font-mono text-6xl md:text-7xl lg:text-8xl font-bold tracking-wider
                    bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent
                    transition-all duration-300
                    ${timerState === "running" ? "animate-pulse" : ""}
                    ${timerState === "stopped" ? "from-[#28c840] via-[#4ade80] to-[#86efac]" : ""}
                  `}
                  style={{
                    textShadow: timerState === "running"
                      ? "0 0 40px rgba(124, 77, 255, 0.5)"
                      : timerState === "stopped"
                        ? "0 0 40px rgba(40, 200, 64, 0.5)"
                        : "none",
                  }}
                >
                  {formatTime(timerSeconds)}
                </div>
              </div>

              {/* Final Time Display (when stopped) */}
              {timerState === "stopped" && finalTime && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#28c840]/10 border border-[#28c840]/30">
                    <Check className="w-4 h-4 text-[#28c840]" />
                    <span className="text-sm font-semibold text-[#28c840]">
                      Time Taken: {finalTime} • {formatDecimalHours(formData.timeTakenHours, formData.timeTakenMinutes).replace('~', '')}
                    </span>
                  </div>
                </div>
              )}

              {/* Timer Controls */}
              <div className="flex items-center justify-center gap-4">
                {/* Start Button */}
                {(timerState === "idle" || timerState === "paused") && (
                  <button
                    onClick={startTimer}
                    className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#7c4dff] to-[#6b3fd4] text-white font-bold uppercase tracking-wider text-sm transition-all duration-200 hover:shadow-[0_0_30px_rgba(124,77,255,0.5)] hover:scale-105"
                  >
                    <Play className="w-5 h-5 transition-transform group-hover:scale-110" />
                    {timerState === "paused" ? "Resume" : "Start"}
                  </button>
                )}

                {/* Pause Button */}
                {timerState === "running" && (
                  <button
                    onClick={pauseTimer}
                    className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#febc2e] to-[#f59e0b] text-black font-bold uppercase tracking-wider text-sm transition-all duration-200 hover:shadow-[0_0_30px_rgba(254,188,46,0.5)] hover:scale-105"
                  >
                    <Pause className="w-5 h-5 transition-transform group-hover:scale-110" />
                    Pause
                  </button>
                )}

                {/* Stop Button */}
                {(timerState === "running" || timerState === "paused") && (
                  <button
                    onClick={stopTimer}
                    className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#28c840] to-[#22c55e] text-white font-bold uppercase tracking-wider text-sm transition-all duration-200 hover:shadow-[0_0_30px_rgba(40,200,64,0.5)] hover:scale-105"
                  >
                    <Square className="w-5 h-5 transition-transform group-hover:scale-110" />
                    Stop
                  </button>
                )}

                {/* Reset Button */}
                {timerState === "stopped" && (
                  <button
                    onClick={resetTimer}
                    className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-bold uppercase tracking-wider text-sm transition-all duration-200 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-105"
                  >
                    <RotateCcw className="w-5 h-5 transition-transform group-hover:rotate-[-45deg]" />
                    Reset
                  </button>
                )}
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-center mt-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${timerState === "running"
                      ? "bg-[#7c4dff] animate-pulse shadow-[0_0_10px_rgba(124,77,255,0.8)]"
                      : timerState === "paused"
                        ? "bg-[#febc2e] shadow-[0_0_10px_rgba(254,188,46,0.8)]"
                        : timerState === "stopped"
                          ? "bg-[#28c840] shadow-[0_0_10px_rgba(40,200,64,0.8)]"
                          : "bg-gray-600"
                      }`}
                  />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {timerState === "idle" && "Ready"}
                    {timerState === "running" && "Running"}
                    {timerState === "paused" && "Paused"}
                    {timerState === "stopped" && "Completed"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact Components

function InputField({
  label,
  placeholder,
  value,
  onChange,
  icon,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#7c4dff] transition-colors">
            {icon}
          </div>
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full bg-[#0a0b10] border border-white/10 rounded-lg 
            text-sm text-gray-300 placeholder-gray-700
            focus:outline-none focus:border-[#7c4dff]/50 focus:bg-[#0f1016] focus:ring-1 focus:ring-[#7c4dff]/20
            transition-all duration-150
            ${icon ? "pl-9 pr-3 py-2" : "px-3 py-2"}
          `}
        />
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">
        {label}
      </label>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full bg-[#0a0b10] border border-white/10 rounded-lg px-3 py-2
                   text-sm text-gray-300 placeholder-gray-700 resize-none
                   focus:outline-none focus:border-[#7c4dff]/50 focus:bg-[#0f1016] focus:ring-1 focus:ring-[#7c4dff]/20
                   transition-all duration-150"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#0a0b10] border border-white/10 rounded-lg px-3 py-2
                     text-sm text-gray-300 appearance-none cursor-pointer
                     focus:outline-none focus:border-[#7c4dff]/50 focus:bg-[#0f1016] focus:ring-1 focus:ring-[#7c4dff]/20
                     transition-all duration-150"
        >
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-[#0a0b10]">
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
          <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </div>
      </div>
    </div>
  );
}
