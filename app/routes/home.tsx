import { useState, useCallback } from "react";
import type { Route } from "./+types/home";
import {
  Play,
  Pause,
  Square,
  Copy,
  Check,
  Activity,
  User,
  Users,
  Link as LinkIcon,
  Clock,
  ClipboardPaste
} from "lucide-react";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Status Updater" },
    { name: "description", content: "Generate quick status updates" },
  ];
}

type StatusType = "START" | "PAUSE" | "STOP";
type UserType = "dev" | "qa";

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

// Helper to format time as 12-hour format (e.g., "2:30PM")
const formatTime12h = (date: Date): string => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Handle midnight (0 -> 12)
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr}${ampm}`;
};

// Parse pasted status text and extract fields
const parseStatusText = (text: string): { project?: string; task?: string; dev?: string; time?: string; userType?: UserType } => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const result: { project?: string; task?: string; dev?: string; time?: string; userType?: UserType } = {};

  for (const line of lines) {
    // Extract time from first line (e.g., "START - 3:11PM")
    const timeMatch = line.match(/^(START|PAUSE|STOP)\s*-\s*(.+)$/i);
    if (timeMatch) {
      result.time = timeMatch[2].trim();
      continue;
    }

    // Match "Key: Value" patterns
    const keyValueMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim().toLowerCase();
      const value = keyValueMatch[2].trim();

      if (key === 'project') result.project = value;
      else if (key === 'task') result.task = value;
      else if (key === 'dev') {
        result.dev = value;
        result.userType = 'dev';
      }
      else if (key === 'qa') {
        result.dev = value;
        result.userType = 'qa';
      }
    }
  }

  return result;
};

export default function Home() {
  const [statusType, setStatusType] = useState<StatusType>("START");
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [copied, setCopied] = useState(false);
  const [userType, setUserType] = useState<UserType>("dev");
  const [capturedTime, setCapturedTime] = useState<string>(formatTime12h(new Date()));
  const [showTime, setShowTime] = useState<boolean>(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");



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
    output += showTime ? `${statusType} - ${capturedTime}\n` : `${statusType}\n`;
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
  }, [statusType, formData, userType, capturedTime, showTime]);

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
    setCapturedTime(formatTime12h(new Date())); // Capture current time when switching tabs
  };

  // Handle paste and auto-fill form fields
  const handlePaste = useCallback(() => {
    const parsed = parseStatusText(pasteText);

    setFormData(prev => ({
      ...prev,
      project: parsed.project || prev.project,
      task: parsed.task || prev.task,
      dev: parsed.dev || prev.dev,
    }));

    if (parsed.userType) setUserType(parsed.userType);
    if (parsed.time) {
      setCapturedTime(parsed.time);
      setShowTime(true);
    }

    setShowPasteModal(false);
    setPasteText("");
  }, [pasteText]);

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

          <div className="flex items-center gap-3">
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
            {/* Time Field with Premium Toggle Switch */}
            <div className={`
              flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-300
              ${showTime
                ? "bg-gradient-to-r from-[#7c4dff]/20 to-[#3b82f6]/20 border border-[#7c4dff]/30 shadow-[0_0_15px_rgba(124,77,255,0.15)]"
                : "bg-[#0a0b10] border border-white/10"
              }
            `}>
              <Clock className={`w-3.5 h-3.5 transition-colors duration-300 ${showTime ? "text-[#7c4dff]" : "text-gray-500"}`} />
              <input
                type="text"
                value={capturedTime}
                onChange={(e) => setCapturedTime(e.target.value)}
                placeholder="2:30PM"
                className={`
                  w-16 bg-transparent text-sm font-semibold focus:outline-none placeholder-gray-600 transition-colors duration-300
                  ${showTime ? "text-white" : "text-gray-400"}
                `}
              />
              {/* Premium Toggle Switch */}
              <button
                onClick={() => setShowTime(!showTime)}
                className={`
                  relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0
                  ${showTime
                    ? "bg-gradient-to-r from-[#7c4dff] to-[#6366f1] shadow-[0_0_10px_rgba(124,77,255,0.4)]"
                    : "bg-gray-700/80 hover:bg-gray-600/80"
                  }
                `}
                title={showTime ? "Time will appear in output" : "Time hidden from output"}
              >
                <span
                  className={`
                    absolute top-0.5 w-4 h-4 rounded-full shadow-md transition-all duration-300 ease-out
                    ${showTime
                      ? "left-[18px] bg-white"
                      : "left-0.5 bg-gray-400"
                    }
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-12 gap-4">

          {/* Form Section */}
          <div className="lg:col-span-7">
            <div className="bg-[#13141c]/80 backdrop-blur-xl rounded-xl border border-white/5 shadow-2xl p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                  <ConfigIcon className="w-3.5 h-3.5 text-[#7c4dff]" />
                  <span>Task Details</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPasteModal(true)}
                    className="flex items-center gap-1 text-[9px] font-bold text-[#7c4dff] hover:text-white transition-colors uppercase tracking-wider"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    Paste
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={clearForm}
                    className="text-[9px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
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

                <div className="p-3 rounded-lg bg-[#0a0b10]/50 border border-white/5 space-y-3">
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

              <div className="flex-1 p-3">
                <div className="font-mono text-[13px] leading-relaxed text-gray-300 whitespace-pre-wrap">
                  {generateOutput().replace(/```/g, "")}
                </div>
              </div>

              <div className="p-3 border-t border-white/5 bg-[#13141c]/50 rounded-b-xl">
                <button
                  onClick={copyToClipboard}
                  className={`
                    w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-200
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
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPasteModal(false)}
          />
          <div className="relative bg-[#13141c] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-[#7c4dff]" />
                <span className="text-sm font-semibold text-white">Paste Previous Status</span>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Paste your previous status here...\n\nExample:\nSTART - 3:11PM\nProject: Urban Space\nTask: PDP - Size Variant issue\nDev: Ashiq`}
                className="w-full h-40 bg-[#0a0b10] border border-white/10 rounded-lg px-3 py-2.5
                           text-sm text-gray-300 placeholder-gray-600 resize-none font-mono
                           focus:outline-none focus:border-[#7c4dff]/50 focus:ring-1 focus:ring-[#7c4dff]/20
                           transition-all duration-150"
                autoFocus
              />
              <p className="text-[10px] text-gray-500 mt-2">
                Extracts: Project, Task, Dev/QA name, and Time (if present)
              </p>
            </div>
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-end gap-2 bg-[#0a0b10]/50">
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPasteText("");
                }}
                className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePaste}
                disabled={!pasteText.trim()}
                className={`
                  px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
                  ${pasteText.trim()
                    ? "bg-gradient-to-r from-[#7c4dff] to-[#6366f1] text-white hover:shadow-[0_0_15px_rgba(124,77,255,0.4)]"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }
                `}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
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
