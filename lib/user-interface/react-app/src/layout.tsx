import React from "react";
import GlobalHeader from "./components/global-header";

interface LayoutProps {
  children: React.ReactNode;
  showHeader: boolean;
}

function Layout({ children, showHeader }: LayoutProps) {
  return (
    <>
      {showHeader && <GlobalHeader />}
      {showHeader && (
        <div style={{ height: "56px", backgroundColor: "#000716" }}>&nbsp;</div>
      )}
      {children}
    </>
  );
}

export default Layout;
