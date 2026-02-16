// components/ActionButton.tsx
import { Check, Lock } from "lucide-react";

interface ActionButtonProps {
  action: {
    key: string;
    label: string;
    desc: string;
    color: string;
    bg: string;
    border: string;
    enabled: boolean;
    onClick: () => void;
  };
  selectedAction: string | null;
  onSelect: (key: string) => void;
}

const ActionButton = ({ action, selectedAction, onSelect }: ActionButtonProps) => (
  <button
    key={action.key}
    onClick={() => {
      if (action.enabled) {
        onSelect(action.key);
        action.onClick();
      }
    }}
    disabled={!action.enabled}
    className={`flex-1 text-left border rounded-lg p-4 transition-all relative ${
      selectedAction === action.key
        ? `border-[${action.border}] bg-[${action.bg}]`
        : action.enabled
        ? "border-[#D5E3EC] bg-white hover:bg-gray-50 cursor-pointer"
        : "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
    }`}
  >
    {!action.enabled && (
      <div className="absolute top-2 right-2">
        <Lock className="w-4 h-4 text-gray-400" />
      </div>
    )}
    <div className="flex items-center gap-2 mb-1">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          selectedAction === action.key
            ? "bg-[#0C4A6E]"
            : action.enabled
            ? "border-2 border-gray-300"
            : "border-2 border-gray-200 bg-gray-100"
        }`}
      >
        {selectedAction === action.key && (
          <Check className="w-3 h-3 text-white" />
        )}
      </div>
      <p
        className={`font-semibold ${
          action.enabled ? "text-[#1E516A]" : "text-gray-500"
        }`}
      >
        {action.label}
      </p>
    </div>
    <p
      className={`text-sm ${
        action.enabled ? "text-gray-600" : "text-gray-400"
      }`}
    >
      {action.desc}
    </p>
  </button>
);

export default ActionButton;