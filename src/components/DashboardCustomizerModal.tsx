import React, { useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Sliders,
  Check,
  RotateCcw,
  Eye,
  Pipette,
  Sparkles,
  Palette,
} from 'lucide-react';
import { DashboardCustomization } from '../types';
import {
  COLOR_PALETTE_FAMILIES,
  POPULAR_PRESET_SHADES,
  ColorShade,
  getContrastColor,
  adjustBrightness,
} from '../services/colorUtils';

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customization: DashboardCustomization;
  onUpdateCustomization: (updates: Partial<DashboardCustomization>) => void;
  onResetDefaults: () => void;
}

export const DashboardCustomizerModal: React.FC<DashboardCustomizerModalProps> = ({
  isOpen,
  onClose,
  customization,
  onUpdateCustomization,
  onResetDefaults,
}) => {
  const [hexInput, setHexInput] = useState(customization.accentColor || '#38bdf8');
  const [brightnessOffset, setBrightnessOffset] = useState(0);

  if (!isOpen) return null;

  const currentHex = customization.accentColor || '#38bdf8';
  const contrastTextColor = getContrastColor(currentHex);

  const handleSelectShade = (shade: ColorShade, familyName: string) => {
    setHexInput(shade.hex);
    setBrightnessOffset(0);
    onUpdateCustomization({
      accentColor: shade.hex,
      accentLabel: `${familyName} (${shade.name})`,
    });
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
      onUpdateCustomization({
        accentColor: val,
        accentLabel: `Custom (${val.toUpperCase()})`,
      });
    }
  };

  const handleNativeColorPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    setBrightnessOffset(0);
    onUpdateCustomization({
      accentColor: val,
      accentLabel: `Custom (${val.toUpperCase()})`,
    });
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const offset = parseInt(e.target.value, 10);
    setBrightnessOffset(offset);
    const adjusted = adjustBrightness(hexInput, offset);
    onUpdateCustomization({
      accentColor: adjusted,
      accentLabel: `Adjusted (${adjusted.toUpperCase()})`,
    });
  };

  const toggleWidget = (widgetKey: keyof DashboardCustomization['visibleWidgets']) => {
    onUpdateCustomization({
      visibleWidgets: {
        ...customization.visibleWidgets,
        [widgetKey]: !customization.visibleWidgets[widgetKey],
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] card-sheen shadow-2xl relative p-5 sm:p-6 text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-high)] flex items-center justify-center border border-[var(--border-subtle)] shadow-sm">
              <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight font-heading">
                Theme &amp; Colour Palette Customizer
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Personalize jet black vs white mode, select shades from the palette, and configure layout.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-high)] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Section 1: Dark (Jet Black) vs White Mode */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">
              Theme Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateCustomization({ themeMode: 'dark' })}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                  customization.themeMode === 'dark'
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-high)] ring-1 ring-[var(--accent-primary)]/40 shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-black border border-white/20 flex items-center justify-center text-white shadow-inner">
                    <Moon className="w-4 h-4 text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold block">
                      Jet Black Dark
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Pure OLED pitch black (#000000)
                    </span>
                  </div>
                </div>
                {customization.themeMode === 'dark' && (
                  <Check className="w-4 h-4 text-[var(--accent-primary)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onUpdateCustomization({ themeMode: 'light' })}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                  customization.themeMode === 'light'
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-high)] ring-1 ring-[var(--accent-primary)]/40 shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-900 shadow-sm">
                    <Sun className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold block">
                      White / Light Mode
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Crisp paper canvas
                    </span>
                  </div>
                </div>
                {customization.themeMode === 'light' && (
                  <Check className="w-4 h-4 text-[var(--accent-primary)]" />
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Colour Palette & Shade Selector */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Colour Palette &amp; Shade Selector
              </label>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Click any shade to apply
              </span>
            </div>

            {/* Active Selected Shade Inspector Card */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl shadow-md border border-white/20 flex items-center justify-center relative overflow-hidden transition-transform active:scale-95 shrink-0"
                  style={{ backgroundColor: currentHex }}
                >
                  <label className="absolute inset-0 cursor-pointer opacity-0" title="Open Color Picker">
                    <input
                      type="color"
                      value={currentHex.length === 7 ? currentHex : '#38bdf8'}
                      onChange={handleNativeColorPick}
                      className="cursor-pointer"
                    />
                  </label>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono tracking-tight">
                      {currentHex.toUpperCase()}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono shadow-xs"
                      style={{
                        backgroundColor: currentHex,
                        color: contrastTextColor,
                      }}
                    >
                      Active Shade
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    {customization.accentLabel || 'Custom Shade'}
                  </span>
                </div>
              </div>

              {/* Direct Hex Input & Eyedropper Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-xs font-mono text-[var(--text-muted)]">#</span>
                  <input
                    type="text"
                    value={hexInput.replace('#', '')}
                    onChange={(e) => handleHexInputChange({ ...e, target: { ...e.target, value: '#' + e.target.value } })}
                    placeholder="38bdf8"
                    maxLength={6}
                    className="w-24 pl-6 pr-2 py-1.5 text-xs font-mono rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] uppercase focus:outline-none focus:border-[var(--accent-primary)] transition-all"
                  />
                </div>

                <label
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-high)] cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                  title="Pick Any Custom Shade with Eyedropper"
                >
                  <Pipette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span className="text-[11px]">Picker</span>
                  <input
                    type="color"
                    value={currentHex.length === 7 ? currentHex : '#38bdf8'}
                    onChange={handleNativeColorPick}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Quick Designer Presets */}
            <div className="mb-4">
              <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1.5">
                Popular Quick Shades
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {POPULAR_PRESET_SHADES.map((preset) => {
                  const isSelected = currentHex.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => {
                        setHexInput(preset.hex);
                        setBrightnessOffset(0);
                        onUpdateCustomization({
                          accentColor: preset.hex,
                          accentLabel: preset.name,
                        });
                      }}
                      className={`h-8 rounded-lg flex items-center justify-center transition-all relative shadow-sm border ${
                        isSelected
                          ? 'border-white ring-2 ring-white/40 scale-105'
                          : 'border-white/10 hover:scale-105 hover:border-white/30'
                      }`}
                      style={{ backgroundColor: preset.hex }}
                      title={preset.name}
                    >
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5"
                          style={{ color: getContrastColor(preset.hex) }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multi-Row Colour Palette Grid by Hue Family */}
            <div className="space-y-2.5 p-3 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)] pb-1 border-b border-[var(--border-subtle)]/60">
                <span>Palette Families</span>
                <span className="font-mono text-[10px]">200 → 700 Shades</span>
              </div>

              {COLOR_PALETTE_FAMILIES.map((family) => (
                <div key={family.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)] w-28 truncate shrink-0">
                    {family.name}
                  </span>

                  <div className="grid grid-cols-6 gap-1.5 flex-1 max-w-[340px]">
                    {family.shades.map((shade) => {
                      const isSelected = currentHex.toLowerCase() === shade.hex.toLowerCase();
                      const textColor = getContrastColor(shade.hex);
                      return (
                        <button
                          key={shade.hex}
                          type="button"
                          onClick={() => handleSelectShade(shade, family.name)}
                          className={`h-7 rounded-md transition-all relative flex items-center justify-center border shadow-xs ${
                            isSelected
                              ? 'border-white ring-2 ring-white/50 scale-110 z-10'
                              : 'border-black/10 dark:border-white/10 hover:scale-105 hover:border-white/30'
                          }`}
                          style={{ backgroundColor: shade.hex }}
                          title={`${shade.name} (${shade.hex})`}
                        >
                          {isSelected && (
                            <Check
                              className="w-3 h-3 stroke-[3]"
                              style={{ color: textColor }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Shade Fine-Tuning Slider */}
            <div className="mt-3.5 p-3 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-[var(--text-secondary)]">
                  Shade Fine-Tuning (Brightness &amp; Tint)
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {brightnessOffset > 0 ? `+${brightnessOffset}%` : `${brightnessOffset}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={brightnessOffset}
                onChange={handleBrightnessChange}
                className="w-full accent-[var(--accent-primary)] cursor-pointer h-1.5 bg-[var(--bg-surface-high)] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1">
                <span>Deeper / Saturated</span>
                <span>Neutral</span>
                <span>Pastel / Bright</span>
              </div>
            </div>
          </div>

          {/* Section 3: Interface Density */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">
              Interface Density
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateCustomization({ density: 'comfortable' })}
                className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all text-center ${
                  customization.density === 'comfortable'
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-high)] text-[var(--accent-primary)] font-semibold shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Comfortable (Spacious)
              </button>
              <button
                type="button"
                onClick={() => onUpdateCustomization({ density: 'compact' })}
                className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all text-center ${
                  customization.density === 'compact'
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-high)] text-[var(--accent-primary)] font-semibold shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Compact (High Density)
              </button>
            </div>
          </div>

          {/* Section 4: Visible Dashboard Widgets */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Visible Dashboard Widgets
              </label>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Toggle on / off
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] space-y-2.5">
              {[
                { key: 'kpiVelocity' as const, label: 'Sprint Velocity & Completion KPI Card' },
                { key: 'kpiUrgent' as const, label: 'Critical Deadlines / Overdue KPI Card' },
                { key: 'kpiCalendar' as const, label: 'Google Calendar Synchronization KPI Card' },
                { key: 'kpiAutomations' as const, label: 'Automations Heartbeat Pulse KPI Card' },
                { key: 'taskVelocityChart' as const, label: '30-Day Task Velocity & Throughput Chart (To-Do to Done)' },
                { key: 'resourceAllocation' as const, label: 'Resource Allocation & Workload Pie Chart' },
                { key: 'upcomingTimeline' as const, label: 'Impending Deliverables Schedule' },
                { key: 'workflowBreakdown' as const, label: 'Sprint Workflow Distribution Matrix' },
                { key: 'morningDigest' as const, label: 'Executive Morning Brief & Gmail Dispatch' },
                { key: 'automationsHeartbeat' as const, label: 'Active Automations Watcher Status' },
              ].map((item) => (

                <div key={item.key} className="flex items-center justify-between text-xs py-1">
                  <span className="text-[var(--text-primary)]">{item.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customization.visibleWidgets[item.key]}
                      onChange={() => toggleWidget(item.key)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[var(--bg-surface-high)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setHexInput('#38bdf8');
              setBrightnessOffset(0);
              onResetDefaults();
            }}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 shadow-md transition-all font-heading"
          >
            Done Customizing
          </button>
        </div>
      </div>
    </div>
  );
};
