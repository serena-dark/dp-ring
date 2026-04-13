import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_UI_CONFIG = {
  schema_version: 1,
  theme: {
    mode: 'system',
    template_id: 'ring-console',
  },
  layout: {
    sidebar_width_px: 272,
    content_padding_px: 24,
    panel_radius_px: 16,
  },
};

const DEFAULT_THEME_TEMPLATES = [
  {
    id: 'ring-console',
    label: 'Ring Console',
    description: 'Neutral operator console with a restrained blue accent.',
    tokens: {
      light: {
        '--theme-bg': '#f3f5f7',
        '--theme-bg-strong': '#eef1f4',
        '--theme-panel': 'rgba(255, 255, 255, 0.94)',
        '--theme-panel-strong': '#ffffff',
        '--theme-line': 'rgba(15, 23, 42, 0.1)',
        '--theme-line-strong': 'rgba(15, 23, 42, 0.18)',
        '--theme-text': '#111827',
        '--theme-muted': '#667085',
        '--theme-accent': '#2563eb',
        '--theme-accent-strong': '#1d4ed8',
        '--theme-accent-soft': 'rgba(37, 99, 235, 0.08)',
        '--theme-blue-soft': 'rgba(37, 99, 235, 0.08)',
        '--theme-success': '#15803d',
        '--theme-warning': '#b45309',
        '--theme-danger': '#b42318',
        '--theme-info': '#2563eb',
        '--theme-shadow': '0 10px 28px rgba(15, 23, 42, 0.06)',
        '--theme-body-background':
          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.06), transparent 32%), linear-gradient(180deg, #f7f8fa 0%, #f1f4f7 100%)',
        '--theme-sidebar-background':
          'linear-gradient(180deg, #f8fafc 0%, #f2f5f8 100%)',
        '--theme-nav-active-border': 'rgba(37, 99, 235, 0.16)',
        '--theme-nav-active-background':
          'linear-gradient(180deg, rgba(37, 99, 235, 0.06), rgba(255, 255, 255, 0.78))',
        '--theme-panel-elevated':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.98))',
        '--theme-surface-overlay': 'rgba(255, 255, 255, 0.8)',
        '--theme-surface-card': 'rgba(255, 255, 255, 0.76)',
        '--theme-surface-card-strong': 'rgba(255, 255, 255, 0.86)',
        '--theme-surface-input': 'rgba(255, 255, 255, 0.96)',
        '--theme-surface-subtle': 'rgba(248, 250, 252, 0.96)',
        '--theme-surface-muted': 'rgba(248, 250, 252, 0.92)',
        '--theme-surface-muted-soft': 'rgba(248, 250, 252, 0.7)',
        '--theme-surface-selected':
          'linear-gradient(180deg, rgba(37, 99, 235, 0.08), rgba(255, 255, 255, 0.92))',
        '--theme-badge-neutral': 'rgba(15, 23, 42, 0.05)',
        '--theme-badge-neutral-text': '#344054',
        '--theme-badge-info': 'rgba(37, 99, 235, 0.08)',
        '--theme-badge-success': 'rgba(21, 128, 61, 0.08)',
        '--theme-badge-warning': 'rgba(180, 83, 9, 0.1)',
        '--theme-badge-danger': 'rgba(180, 35, 24, 0.08)',
        '--theme-badge-muted': 'rgba(102, 112, 133, 0.08)',
        '--theme-button-primary-background': '#111827',
        '--theme-button-primary-border': '#111827',
        '--theme-button-primary-text': '#ffffff',
        '--theme-button-primary-hover-background': '#1f2937',
        '--theme-button-primary-hover-border': '#1f2937',
        '--theme-meter-track': 'rgba(15, 23, 42, 0.08)',
        '--theme-meter-fill': 'linear-gradient(90deg, #60a5fa, #2563eb)',
        '--theme-timeline-dot-ring': 'rgba(37, 99, 235, 0.14)',
        '--theme-code-border': '#111827',
        '--theme-code-background': '#0f172a',
        '--theme-code-text': '#e5e7eb',
        '--theme-info-border-soft': 'rgba(33, 102, 194, 0.18)',
        '--theme-success-border-soft': 'rgba(25, 135, 84, 0.22)',
        '--theme-danger-border-soft': 'rgba(192, 57, 43, 0.24)',
        '--theme-composer-background':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98))',
        '--theme-machine-surface': 'rgba(255, 255, 255, 0.82)',
        '--theme-machine-node': 'rgba(248, 250, 252, 0.94)',
        '--theme-machine-node-current-border': 'rgba(37, 99, 235, 0.3)',
        '--theme-machine-node-current-background':
          'linear-gradient(180deg, rgba(37, 99, 235, 0.08), rgba(255, 255, 255, 0.96))',
        '--theme-machine-node-current-shadow':
          '0 10px 24px rgba(37, 99, 235, 0.08)',
        '--theme-machine-node-visited-border': 'rgba(37, 99, 235, 0.16)',
        '--theme-machine-node-visited-background':
          'linear-gradient(180deg, rgba(37, 99, 235, 0.04), rgba(255, 255, 255, 0.92))',
        '--theme-machine-node-reachable-border': 'rgba(22, 34, 48, 0.24)',
        '--theme-machine-arrow': 'rgba(22, 34, 48, 0.12)',
        '--theme-machine-arrow-head': 'rgba(22, 34, 48, 0.18)',
        '--theme-machine-arrow-active': 'rgba(37, 99, 235, 0.5)',
        '--theme-machine-arrow-active-head': 'rgba(37, 99, 235, 0.7)',
        '--theme-machine-branch': 'rgba(255, 255, 255, 0.92)',
        '--theme-machine-branch-active-border': 'rgba(37, 99, 235, 0.2)',
        '--theme-machine-branch-active-background': 'rgba(37, 99, 235, 0.08)',
        '--theme-theme-option-background': 'rgba(255, 255, 255, 0.76)',
        '--theme-theme-option-selected-border': 'rgba(37, 99, 235, 0.28)',
        '--theme-theme-option-selected-shadow':
          'inset 0 0 0 1px rgba(37, 99, 235, 0.22)',
        '--theme-pulse': 'rgba(37, 99, 235, 0.24)',
        '--theme-pulse-fade': 'rgba(37, 99, 235, 0)',
        '--theme-pulse-end': 'rgba(214, 103, 61, 0)',
      },
      dark: {
        '--theme-bg': '#0b1220',
        '--theme-bg-strong': '#111827',
        '--theme-panel': 'rgba(15, 23, 42, 0.92)',
        '--theme-panel-strong': '#111827',
        '--theme-line': 'rgba(148, 163, 184, 0.18)',
        '--theme-line-strong': 'rgba(148, 163, 184, 0.28)',
        '--theme-text': '#e5e7eb',
        '--theme-muted': '#94a3b8',
        '--theme-accent': '#60a5fa',
        '--theme-accent-strong': '#93c5fd',
        '--theme-accent-soft': 'rgba(96, 165, 250, 0.14)',
        '--theme-blue-soft': 'rgba(96, 165, 250, 0.14)',
        '--theme-success': '#4ade80',
        '--theme-warning': '#f59e0b',
        '--theme-danger': '#f87171',
        '--theme-info': '#60a5fa',
        '--theme-shadow': '0 14px 32px rgba(2, 6, 23, 0.36)',
        '--theme-body-background':
          'radial-gradient(circle at top left, rgba(96, 165, 250, 0.08), transparent 32%), linear-gradient(180deg, #020617 0%, #0b1220 100%)',
        '--theme-sidebar-background':
          'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 18, 32, 0.98) 100%)',
        '--theme-nav-active-border': 'rgba(96, 165, 250, 0.22)',
        '--theme-nav-active-background':
          'linear-gradient(180deg, rgba(96, 165, 250, 0.12), rgba(15, 23, 42, 0.94))',
        '--theme-panel-elevated':
          'linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(17, 24, 39, 0.96))',
        '--theme-surface-overlay': 'rgba(15, 23, 42, 0.88)',
        '--theme-surface-card': 'rgba(15, 23, 42, 0.9)',
        '--theme-surface-card-strong': 'rgba(15, 23, 42, 0.92)',
        '--theme-surface-input': 'rgba(15, 23, 42, 0.96)',
        '--theme-surface-subtle': 'rgba(15, 23, 42, 0.98)',
        '--theme-surface-muted': 'rgba(15, 23, 42, 0.88)',
        '--theme-surface-muted-soft': 'rgba(30, 41, 59, 0.64)',
        '--theme-surface-selected':
          'linear-gradient(180deg, rgba(96, 165, 250, 0.14), rgba(15, 23, 42, 0.94))',
        '--theme-badge-neutral': 'rgba(15, 23, 42, 0.88)',
        '--theme-badge-neutral-text': '#cbd5e1',
        '--theme-badge-info': 'rgba(96, 165, 250, 0.18)',
        '--theme-badge-success': 'rgba(74, 222, 128, 0.16)',
        '--theme-badge-warning': 'rgba(245, 158, 11, 0.18)',
        '--theme-badge-danger': 'rgba(248, 113, 113, 0.18)',
        '--theme-badge-muted': 'rgba(148, 163, 184, 0.14)',
        '--theme-button-primary-background': '#e5e7eb',
        '--theme-button-primary-border': '#e5e7eb',
        '--theme-button-primary-text': '#0b1220',
        '--theme-button-primary-hover-background': '#cbd5e1',
        '--theme-button-primary-hover-border': '#cbd5e1',
        '--theme-meter-track': 'rgba(148, 163, 184, 0.18)',
        '--theme-meter-fill': 'linear-gradient(90deg, #93c5fd, #60a5fa)',
        '--theme-timeline-dot-ring': 'rgba(96, 165, 250, 0.24)',
        '--theme-code-border': 'rgba(148, 163, 184, 0.22)',
        '--theme-code-background': '#020617',
        '--theme-code-text': '#e5e7eb',
        '--theme-info-border-soft': 'rgba(96, 165, 250, 0.22)',
        '--theme-success-border-soft': 'rgba(74, 222, 128, 0.24)',
        '--theme-danger-border-soft': 'rgba(248, 113, 113, 0.24)',
        '--theme-composer-background':
          'linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(17, 24, 39, 0.96))',
        '--theme-machine-surface': 'rgba(15, 23, 42, 0.9)',
        '--theme-machine-node': 'rgba(15, 23, 42, 0.9)',
        '--theme-machine-node-current-border': 'rgba(96, 165, 250, 0.32)',
        '--theme-machine-node-current-background':
          'linear-gradient(180deg, rgba(96, 165, 250, 0.16), rgba(15, 23, 42, 0.96))',
        '--theme-machine-node-current-shadow':
          '0 12px 28px rgba(2, 6, 23, 0.34)',
        '--theme-machine-node-visited-border': 'rgba(96, 165, 250, 0.18)',
        '--theme-machine-node-visited-background':
          'linear-gradient(180deg, rgba(96, 165, 250, 0.08), rgba(15, 23, 42, 0.92))',
        '--theme-machine-node-reachable-border': 'rgba(148, 163, 184, 0.24)',
        '--theme-machine-arrow': 'rgba(148, 163, 184, 0.16)',
        '--theme-machine-arrow-head': 'rgba(148, 163, 184, 0.22)',
        '--theme-machine-arrow-active': 'rgba(96, 165, 250, 0.5)',
        '--theme-machine-arrow-active-head': 'rgba(96, 165, 250, 0.74)',
        '--theme-machine-branch': 'rgba(15, 23, 42, 0.88)',
        '--theme-machine-branch-active-border': 'rgba(96, 165, 250, 0.24)',
        '--theme-machine-branch-active-background': 'rgba(96, 165, 250, 0.14)',
        '--theme-theme-option-background': 'rgba(15, 23, 42, 0.92)',
        '--theme-theme-option-selected-border': 'rgba(96, 165, 250, 0.32)',
        '--theme-theme-option-selected-shadow':
          'inset 0 0 0 1px rgba(96, 165, 250, 0.24)',
        '--theme-pulse': 'rgba(96, 165, 250, 0.24)',
        '--theme-pulse-fade': 'rgba(96, 165, 250, 0)',
        '--theme-pulse-end': 'rgba(96, 165, 250, 0)',
      },
    },
  },
  {
    id: 'signal-graphite',
    label: 'Signal Graphite',
    description: 'Graphite surfaces with a cyan signal accent.',
    tokens: {
      light: {
        '--theme-bg': '#f2f4f5',
        '--theme-bg-strong': '#e8ecee',
        '--theme-panel': 'rgba(255, 255, 255, 0.94)',
        '--theme-panel-strong': '#ffffff',
        '--theme-line': 'rgba(11, 18, 32, 0.1)',
        '--theme-line-strong': 'rgba(11, 18, 32, 0.18)',
        '--theme-text': '#0f1720',
        '--theme-muted': '#5f6b7a',
        '--theme-accent': '#0891b2',
        '--theme-accent-strong': '#0f766e',
        '--theme-accent-soft': 'rgba(8, 145, 178, 0.1)',
        '--theme-blue-soft': 'rgba(8, 145, 178, 0.1)',
        '--theme-success': '#15803d',
        '--theme-warning': '#b45309',
        '--theme-danger': '#b42318',
        '--theme-info': '#0891b2',
        '--theme-shadow': '0 10px 28px rgba(11, 18, 32, 0.06)',
        '--theme-body-background':
          'radial-gradient(circle at top left, rgba(8, 145, 178, 0.08), transparent 32%), linear-gradient(180deg, #f6f8f9 0%, #eef2f4 100%)',
        '--theme-sidebar-background':
          'linear-gradient(180deg, #f7f9fa 0%, #eef2f4 100%)',
        '--theme-nav-active-border': 'rgba(8, 145, 178, 0.18)',
        '--theme-nav-active-background':
          'linear-gradient(180deg, rgba(8, 145, 178, 0.08), rgba(255, 255, 255, 0.8))',
        '--theme-panel-elevated':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(242, 246, 248, 0.98))',
        '--theme-surface-overlay': 'rgba(255, 255, 255, 0.8)',
        '--theme-surface-card': 'rgba(255, 255, 255, 0.78)',
        '--theme-surface-card-strong': 'rgba(255, 255, 255, 0.88)',
        '--theme-surface-input': 'rgba(255, 255, 255, 0.96)',
        '--theme-surface-subtle': 'rgba(244, 247, 248, 0.96)',
        '--theme-surface-muted': 'rgba(244, 247, 248, 0.92)',
        '--theme-surface-muted-soft': 'rgba(244, 247, 248, 0.74)',
        '--theme-surface-selected':
          'linear-gradient(180deg, rgba(8, 145, 178, 0.1), rgba(255, 255, 255, 0.92))',
        '--theme-badge-neutral': 'rgba(11, 18, 32, 0.06)',
        '--theme-badge-neutral-text': '#334155',
        '--theme-badge-info': 'rgba(8, 145, 178, 0.1)',
        '--theme-badge-success': 'rgba(21, 128, 61, 0.08)',
        '--theme-badge-warning': 'rgba(180, 83, 9, 0.1)',
        '--theme-badge-danger': 'rgba(180, 35, 24, 0.08)',
        '--theme-badge-muted': 'rgba(95, 107, 122, 0.1)',
        '--theme-button-primary-background': '#0f1720',
        '--theme-button-primary-border': '#0f1720',
        '--theme-button-primary-text': '#ffffff',
        '--theme-button-primary-hover-background': '#1d2939',
        '--theme-button-primary-hover-border': '#1d2939',
        '--theme-meter-track': 'rgba(11, 18, 32, 0.08)',
        '--theme-meter-fill': 'linear-gradient(90deg, #22d3ee, #0891b2)',
        '--theme-timeline-dot-ring': 'rgba(8, 145, 178, 0.16)',
        '--theme-code-border': '#0f1720',
        '--theme-code-background': '#07111b',
        '--theme-code-text': '#dbeafe',
        '--theme-info-border-soft': 'rgba(8, 145, 178, 0.2)',
        '--theme-success-border-soft': 'rgba(25, 135, 84, 0.22)',
        '--theme-danger-border-soft': 'rgba(192, 57, 43, 0.24)',
        '--theme-composer-background':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(242, 246, 248, 0.98))',
        '--theme-machine-surface': 'rgba(255, 255, 255, 0.84)',
        '--theme-machine-node': 'rgba(244, 247, 248, 0.94)',
        '--theme-machine-node-current-border': 'rgba(8, 145, 178, 0.32)',
        '--theme-machine-node-current-background':
          'linear-gradient(180deg, rgba(8, 145, 178, 0.1), rgba(255, 255, 255, 0.96))',
        '--theme-machine-node-current-shadow':
          '0 10px 24px rgba(8, 145, 178, 0.08)',
        '--theme-machine-node-visited-border': 'rgba(8, 145, 178, 0.18)',
        '--theme-machine-node-visited-background':
          'linear-gradient(180deg, rgba(8, 145, 178, 0.06), rgba(255, 255, 255, 0.92))',
        '--theme-machine-node-reachable-border': 'rgba(22, 34, 48, 0.24)',
        '--theme-machine-arrow': 'rgba(22, 34, 48, 0.12)',
        '--theme-machine-arrow-head': 'rgba(22, 34, 48, 0.18)',
        '--theme-machine-arrow-active': 'rgba(8, 145, 178, 0.5)',
        '--theme-machine-arrow-active-head': 'rgba(8, 145, 178, 0.7)',
        '--theme-machine-branch': 'rgba(255, 255, 255, 0.92)',
        '--theme-machine-branch-active-border': 'rgba(8, 145, 178, 0.22)',
        '--theme-machine-branch-active-background': 'rgba(8, 145, 178, 0.1)',
        '--theme-theme-option-background': 'rgba(255, 255, 255, 0.76)',
        '--theme-theme-option-selected-border': 'rgba(8, 145, 178, 0.3)',
        '--theme-theme-option-selected-shadow':
          'inset 0 0 0 1px rgba(8, 145, 178, 0.22)',
        '--theme-pulse': 'rgba(8, 145, 178, 0.24)',
        '--theme-pulse-fade': 'rgba(8, 145, 178, 0)',
        '--theme-pulse-end': 'rgba(8, 145, 178, 0)',
      },
      dark: {
        '--theme-bg': '#09131b',
        '--theme-bg-strong': '#10202a',
        '--theme-panel': 'rgba(8, 20, 32, 0.92)',
        '--theme-panel-strong': '#10202a',
        '--theme-line': 'rgba(125, 211, 252, 0.14)',
        '--theme-line-strong': 'rgba(125, 211, 252, 0.22)',
        '--theme-text': '#e2edf3',
        '--theme-muted': '#8aa1af',
        '--theme-accent': '#22d3ee',
        '--theme-accent-strong': '#67e8f9',
        '--theme-accent-soft': 'rgba(34, 211, 238, 0.14)',
        '--theme-blue-soft': 'rgba(34, 211, 238, 0.14)',
        '--theme-success': '#4ade80',
        '--theme-warning': '#f59e0b',
        '--theme-danger': '#f87171',
        '--theme-info': '#22d3ee',
        '--theme-shadow': '0 14px 32px rgba(2, 6, 23, 0.38)',
        '--theme-body-background':
          'radial-gradient(circle at top left, rgba(34, 211, 238, 0.08), transparent 32%), linear-gradient(180deg, #040c12 0%, #09131b 100%)',
        '--theme-sidebar-background':
          'linear-gradient(180deg, rgba(8, 20, 32, 0.98) 0%, rgba(9, 19, 27, 0.98) 100%)',
        '--theme-nav-active-border': 'rgba(34, 211, 238, 0.22)',
        '--theme-nav-active-background':
          'linear-gradient(180deg, rgba(34, 211, 238, 0.14), rgba(8, 20, 32, 0.94))',
        '--theme-panel-elevated':
          'linear-gradient(180deg, rgba(8, 20, 32, 0.94), rgba(16, 32, 42, 0.96))',
        '--theme-surface-overlay': 'rgba(8, 20, 32, 0.88)',
        '--theme-surface-card': 'rgba(8, 20, 32, 0.9)',
        '--theme-surface-card-strong': 'rgba(8, 20, 32, 0.94)',
        '--theme-surface-input': 'rgba(8, 20, 32, 0.96)',
        '--theme-surface-subtle': 'rgba(6, 14, 24, 0.98)',
        '--theme-surface-muted': 'rgba(8, 20, 32, 0.88)',
        '--theme-surface-muted-soft': 'rgba(20, 36, 48, 0.62)',
        '--theme-surface-selected':
          'linear-gradient(180deg, rgba(34, 211, 238, 0.14), rgba(8, 20, 32, 0.94))',
        '--theme-badge-neutral': 'rgba(8, 20, 32, 0.88)',
        '--theme-badge-neutral-text': '#d7e5ec',
        '--theme-badge-info': 'rgba(34, 211, 238, 0.18)',
        '--theme-badge-success': 'rgba(74, 222, 128, 0.16)',
        '--theme-badge-warning': 'rgba(245, 158, 11, 0.18)',
        '--theme-badge-danger': 'rgba(248, 113, 113, 0.18)',
        '--theme-badge-muted': 'rgba(138, 161, 175, 0.16)',
        '--theme-button-primary-background': '#e2edf3',
        '--theme-button-primary-border': '#e2edf3',
        '--theme-button-primary-text': '#09131b',
        '--theme-button-primary-hover-background': '#c7d9e3',
        '--theme-button-primary-hover-border': '#c7d9e3',
        '--theme-meter-track': 'rgba(125, 211, 252, 0.14)',
        '--theme-meter-fill': 'linear-gradient(90deg, #67e8f9, #22d3ee)',
        '--theme-timeline-dot-ring': 'rgba(34, 211, 238, 0.24)',
        '--theme-code-border': 'rgba(125, 211, 252, 0.2)',
        '--theme-code-background': '#02080d',
        '--theme-code-text': '#dbeafe',
        '--theme-info-border-soft': 'rgba(34, 211, 238, 0.24)',
        '--theme-success-border-soft': 'rgba(74, 222, 128, 0.24)',
        '--theme-danger-border-soft': 'rgba(248, 113, 113, 0.24)',
        '--theme-composer-background':
          'linear-gradient(180deg, rgba(8, 20, 32, 0.94), rgba(16, 32, 42, 0.96))',
        '--theme-machine-surface': 'rgba(8, 20, 32, 0.9)',
        '--theme-machine-node': 'rgba(8, 20, 32, 0.9)',
        '--theme-machine-node-current-border': 'rgba(34, 211, 238, 0.34)',
        '--theme-machine-node-current-background':
          'linear-gradient(180deg, rgba(34, 211, 238, 0.16), rgba(8, 20, 32, 0.96))',
        '--theme-machine-node-current-shadow':
          '0 12px 28px rgba(2, 6, 23, 0.34)',
        '--theme-machine-node-visited-border': 'rgba(34, 211, 238, 0.18)',
        '--theme-machine-node-visited-background':
          'linear-gradient(180deg, rgba(34, 211, 238, 0.08), rgba(8, 20, 32, 0.92))',
        '--theme-machine-node-reachable-border': 'rgba(125, 211, 252, 0.2)',
        '--theme-machine-arrow': 'rgba(125, 211, 252, 0.14)',
        '--theme-machine-arrow-head': 'rgba(125, 211, 252, 0.2)',
        '--theme-machine-arrow-active': 'rgba(34, 211, 238, 0.52)',
        '--theme-machine-arrow-active-head': 'rgba(34, 211, 238, 0.74)',
        '--theme-machine-branch': 'rgba(8, 20, 32, 0.88)',
        '--theme-machine-branch-active-border': 'rgba(34, 211, 238, 0.24)',
        '--theme-machine-branch-active-background': 'rgba(34, 211, 238, 0.14)',
        '--theme-theme-option-background': 'rgba(8, 20, 32, 0.92)',
        '--theme-theme-option-selected-border': 'rgba(34, 211, 238, 0.32)',
        '--theme-theme-option-selected-shadow':
          'inset 0 0 0 1px rgba(34, 211, 238, 0.24)',
        '--theme-pulse': 'rgba(34, 211, 238, 0.24)',
        '--theme-pulse-fade': 'rgba(34, 211, 238, 0)',
        '--theme-pulse-end': 'rgba(34, 211, 238, 0)',
      },
    },
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_UI_CONFIG.theme.mode;
}

function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeTokenMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => key.startsWith('--') && typeof item === 'string' && item.trim()),
  );
}

function normalizeTemplate(input, index) {
  const id =
    typeof input?.id === 'string' && input.id.trim()
      ? input.id.trim()
      : `theme-${index + 1}`;
  const label =
    typeof input?.label === 'string' && input.label.trim()
      ? input.label.trim()
      : id;
  const description =
    typeof input?.description === 'string' ? input.description.trim() : '';

  return {
    id,
    label,
    description,
    tokens: {
      light: normalizeTokenMap(input?.tokens?.light),
      dark: normalizeTokenMap(input?.tokens?.dark),
    },
  };
}

function mergeThemeTemplates(rawTemplates) {
  const merged = new Map(
    DEFAULT_THEME_TEMPLATES.map((template, index) => [
      template.id,
      normalizeTemplate(template, index),
    ]),
  );

  if (Array.isArray(rawTemplates)) {
    rawTemplates.forEach((template, index) => {
      const normalized = normalizeTemplate(template, index);
      const existing = merged.get(normalized.id);
      merged.set(normalized.id, {
        ...normalized,
        tokens: {
          light: {
            ...(existing?.tokens?.light ?? {}),
            ...normalized.tokens.light,
          },
          dark: {
            ...(existing?.tokens?.dark ?? {}),
            ...normalized.tokens.dark,
          },
        },
      });
    });
  }

  return [...merged.values()];
}

function mergeUiConfig(raw, templates) {
  const templateIds = new Set(templates.map((template) => template.id));
  const requestedTemplateId =
    typeof raw?.theme?.template_id === 'string' ? raw.theme.template_id : '';
  const templateId = templateIds.has(requestedTemplateId)
    ? requestedTemplateId
    : DEFAULT_UI_CONFIG.theme.template_id;

  return {
    ...DEFAULT_UI_CONFIG,
    ...raw,
    theme: {
      ...DEFAULT_UI_CONFIG.theme,
      ...(raw?.theme ?? {}),
      mode: normalizeThemeMode(raw?.theme?.mode),
      template_id: templateId,
    },
    layout: {
      ...DEFAULT_UI_CONFIG.layout,
      ...(raw?.layout ?? {}),
      sidebar_width_px: normalizeNumber(
        raw?.layout?.sidebar_width_px,
        DEFAULT_UI_CONFIG.layout.sidebar_width_px,
      ),
      content_padding_px: normalizeNumber(
        raw?.layout?.content_padding_px,
        DEFAULT_UI_CONFIG.layout.content_padding_px,
      ),
      panel_radius_px: normalizeNumber(
        raw?.layout?.panel_radius_px,
        DEFAULT_UI_CONFIG.layout.panel_radius_px,
      ),
    },
  };
}

export async function createUiConfig(repoRoot) {
  const uiDir = join(repoRoot, '.ring', 'ui');
  const configPath = join(uiDir, 'config.json');
  const themesPath = join(uiDir, 'theme-templates.json');

  async function ensureDir() {
    await mkdir(uiDir, { recursive: true });
  }

  async function getThemes() {
    await ensureDir();

    try {
      const raw = JSON.parse(await readFile(themesPath, 'utf-8'));
      const templates = mergeThemeTemplates(raw);
      await writeFile(themesPath, JSON.stringify(templates, null, 2) + '\n', 'utf-8');
      return templates;
    } catch {
      const templates = clone(DEFAULT_THEME_TEMPLATES);
      await writeFile(themesPath, JSON.stringify(templates, null, 2) + '\n', 'utf-8');
      return templates;
    }
  }

  async function getConfig() {
    await ensureDir();
    const templates = await getThemes();

    try {
      const raw = JSON.parse(await readFile(configPath, 'utf-8'));
      const config = mergeUiConfig(raw, templates);
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      return config;
    } catch {
      const config = mergeUiConfig(DEFAULT_UI_CONFIG, templates);
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      return config;
    }
  }

  async function updateConfig(patch) {
    const templates = await getThemes();
    const existing = await getConfig();
    const next = mergeUiConfig(
      {
        ...existing,
        ...patch,
        theme: {
          ...existing.theme,
          ...(patch?.theme ?? {}),
        },
        layout: {
          ...existing.layout,
          ...(patch?.layout ?? {}),
        },
      },
      templates,
    );
    await writeFile(configPath, JSON.stringify(next, null, 2) + '\n', 'utf-8');
    return next;
  }

  return {
    getConfig,
    updateConfig,
    getThemes,
  };
}
