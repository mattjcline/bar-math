import { useState, type KeyboardEvent } from "react";
import { filterSuggestions } from "./utils";

type NameAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
};

export default function NameAutocomplete({ value, onChange, suggestions, placeholder }: NameAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const matches = filterSuggestions(suggestions, value);

  const selectMatch = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectMatch(matches[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="autocomplete">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && matches.length > 0 && (
        <ul className="autocomplete-list">
          {matches.map((name, i) => (
            <li
              key={name}
              className={`autocomplete-option ${i === highlightedIndex ? "highlighted" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMatch(name);
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
