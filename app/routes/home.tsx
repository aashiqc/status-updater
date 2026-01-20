import { useState, useCallback } from "react";
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
  FileText
} from "lucide-react";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Status Updater" },
    { name: "description", content: "Generate quick status updates" },
  ];
}

type StatusType = "START" | "PAUSE" | "STOP";

interface FormData {
  project: string;
  task: string;
  dev: string;
  // START fields
  estimatedTime: string;
  reference: string;
  // PAUSE fields
  pauseStatus: string;
  pauseReason: string;
  progress: string;
  // STOP fields
  stopStatus: string;
  timeTaken: string;
  notes: string;
}

const initialFormData: FormData = {
  project: "",
  task: "",
  dev: "",
  estimatedTime: "",
  reference: "",
  pauseStatus: "In Progress",
  pauseReason: "",
  progress: "",
  stopStatus: "Moved to QA",
  timeTaken: "",
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

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const generateOutput = useCallback(() => {
    let output = "```\n";
    output += `${statusType}\n`;
    output += `Project: ${formData.project || "<brand name>"}\n`;
    output += `Task: ${formData.task || "<short description>"}\n`;

    if (statusType === "START") {
      output += `Estimated Time: ${formData.estimatedTime || "<e.g. 30 mins / 2 hours>"}\n`;
      output += `Reference: ${formData.reference || "nil"}\n`;
    } else if (statusType === "PAUSE") {
      output += `Status: ${formData.pauseStatus}\n`;
      output += `Reason: ${formData.pauseReason || "<short reason>"}\n`;
      output += `Progress: ${formData.progress || "<what is done so far>"}\n`;
    } else {
      // Ensure timeTaken starts with ~ if not present
      let timeTaken = formData.timeTaken || "<approx time spent>";
      if (formData.timeTaken && !timeTaken.startsWith("~")) {
        timeTaken = `~${timeTaken}`;
      }

      output += `Status: ${formData.stopStatus}\n`;
      output += `Time Taken: ${timeTaken}\n`;
      output += `Notes: ${formData.notes || "<build number>"}\n`;
    }

    output += `Dev: ${formData.dev || "<your name>"}\n`;
    output += "```";
    return output;
  }, [statusType, formData]);

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

    // Auto-fill timeTaken if switching to STOP and it's empty
    if (type === "STOP" && !formData.timeTaken && formData.estimatedTime) {
      setFormData(prev => ({
        ...prev,
        timeTaken: formData.estimatedTime.startsWith("~") ? formData.estimatedTime : `~${formData.estimatedTime}`
      }));
    }
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
                    label="Dev Name"
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
                      <div className="grid grid-cols-2 gap-4">
                        <InputField
                          label="Time"
                          placeholder="2 hours"
                          value={formData.estimatedTime}
                          onChange={(v) => updateField("estimatedTime", v)}
                          icon={<Clock className="w-3.5 h-3.5" />}
                        />
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
                      <div className="grid grid-cols-2 gap-4">
                        <SelectField
                          label="Status"
                          value={formData.stopStatus}
                          onChange={(v) => updateField("stopStatus", v)}
                          options={["Done", "Moved to QA", "Dropped", "Re-scoped"]}
                        />
                        <InputField
                          label="Time Taken"
                          placeholder="~3 hours"
                          value={formData.timeTaken}
                          onChange={(v) => updateField("timeTaken", v)}
                        />
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
        rows={3}
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
