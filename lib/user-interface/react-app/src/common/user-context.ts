import { Dispatch, SetStateAction, createContext } from "react";
import { UserRole } from "./types";

export type UserContextValue = {
  userRole: UserRole;
  userEmail: string;
  setUserEmail: Dispatch<SetStateAction<string>>;
  setUserRole: Dispatch<SetStateAction<UserRole>>;
};

export const userContextDefault: UserContextValue = {
  userRole: UserRole.UNDEFINED,
  userEmail: "",
  setUserRole: () => {},
  setUserEmail: () => {},
};

export const UserContext = createContext(userContextDefault);
