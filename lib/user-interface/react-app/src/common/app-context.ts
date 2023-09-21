import { createContext } from "react";
import { AppConfig } from "./types";

export const AppContext = createContext<AppConfig | null>(null);
