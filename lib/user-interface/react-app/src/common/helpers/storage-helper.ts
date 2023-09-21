import { Mode, applyMode } from "@cloudscape-design/global-styles";
import { NavigationPanelState } from "../types";

const PREFIX = "aws-genai-llm-chatbot";
const THEME_STORAGE_NAME = `${PREFIX}-theme`;
const SELECTED_MODEL_STORAGE_NAME = `${PREFIX}-selected-model`;
const SELECTED_WORKSPACE_STORAGE_NAME = `${PREFIX}-selected-workspace`;
const NAVIGATION_PANEL_STATE_STORAGE_NAME = `${PREFIX}-navigation-panel-state`;

export abstract class StorageHelper {
  static getTheme() {
    const value = localStorage.getItem(THEME_STORAGE_NAME) ?? Mode.Light;
    const theme = value === Mode.Dark ? Mode.Dark : Mode.Light;

    return theme;
  }

  static applyTheme(theme: Mode) {
    localStorage.setItem(THEME_STORAGE_NAME, theme);
    applyMode(theme);

    document.documentElement.style.setProperty(
      "--app-color-scheme",
      theme === Mode.Dark ? "dark" : "light"
    );

    return theme;
  }

  static getNavigationPanelState(): NavigationPanelState {
    const value =
      localStorage.getItem(NAVIGATION_PANEL_STATE_STORAGE_NAME) ??
      JSON.stringify({
        collapsed: true,
      });

    let state: NavigationPanelState | null = null;
    try {
      state = JSON.parse(value);
    } catch {
      state = {};
    }

    return state ?? {};
  }

  static setNavigationPanelState(state: Partial<NavigationPanelState>) {
    const currentState = this.getNavigationPanelState();
    const newState = { ...currentState, ...state };
    const stateStr = JSON.stringify(newState);
    localStorage.setItem(NAVIGATION_PANEL_STATE_STORAGE_NAME, stateStr);

    return newState;
  }

  static getSelectedLLM() {
    const value = localStorage.getItem(SELECTED_MODEL_STORAGE_NAME) ?? null;

    return value;
  }

  static setSelectedLLM(model: string) {
    localStorage.setItem(SELECTED_MODEL_STORAGE_NAME, model);
  }

  static getSelectedWorkspaceId() {
    const value = localStorage.getItem(SELECTED_WORKSPACE_STORAGE_NAME) ?? null;

    return value;
  }

  static setSelectedWorkspaceId(workspaceId: string) {
    localStorage.setItem(SELECTED_WORKSPACE_STORAGE_NAME, workspaceId);
  }
}
