import { Dispatch, SetStateAction, createContext } from "react";

export type UserContextValue = {
  userRoles: string[];
  userEmail: string;
  setUserEmail: Dispatch<SetStateAction<string>>;
  setUserRoles: Dispatch<SetStateAction<string[]>>;
};

export const userContextDefault: UserContextValue = {
  userRoles: [],
  userEmail: "",
  setUserRoles: () => {},
  setUserEmail: () => {},
};

export const UserContext = createContext(userContextDefault);
