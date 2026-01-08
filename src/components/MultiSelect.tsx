
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const getDisplayLabel = () => {
    if (selectedValues.length === 0) return label;
    if (selectedValues.length === 1) {
        return options.find(o => o.value === selectedValues[0])?.label || selectedValues[0];
    }
    if (selectedValues.length === options.length) return 'Vše vybráno';
    return `${selectedValues.length} vybráno`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-xs font-bold text-gray-400 block mb-1">{label}</label>
      <div 
        className="w-full border rounded p-2 text-xs bg-white flex justify-between items-center cursor-pointer min-h-[34px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`${selectedValues.length === 0 ? 'text-gray-400' : 'text-gray-900'} truncate mr-2`}>
          {getDisplayLabel()}
        </span>
        <div className="flex items-center gap-1">
            {selectedValues.length > 0 && (
                <div 
                    onClick={(e) => { e.stopPropagation(); onChange([]); }}
                    className="p-0.5 hover:bg-gray-200 rounded-full text-gray-400"
                >
                    <X size={12} />
                </div>
            )}
            <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <div
                key={option.value}
                className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 text-xs border-b last:border-0 border-gray-50 ${isSelected ? 'bg-blue-50 text-blue-800' : 'text-gray-700'}`}
                onClick={() => toggleOption(option.value)}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                  {isSelected && <Check size={10} className="text-white" />}
                </div>
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
