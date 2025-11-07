import React, { createContext, useContext, useState, useCallback } from 'react';

interface ScrollContextType {
  isScrollingDown: boolean;
  isAtBottom: boolean;
  setScrollDirection: (isDown: boolean) => void;
  setAtBottom: (atBottom: boolean) => void;
  shouldShowTabBar: boolean;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true); // Start at bottom (show tab bar initially)

  const setScrollDirection = useCallback((isDown: boolean) => {
    setIsScrollingDown(isDown);
  }, []);

  const setAtBottom = useCallback((atBottom: boolean) => {
    setIsAtBottom(atBottom);
  }, []);

  // Show tab bar when:
  // 1. User is at bottom of page
  // 2. User is scrolling up
  const shouldShowTabBar = !isScrollingDown || isAtBottom;

  return (
    <ScrollContext.Provider
      value={{
        isScrollingDown,
        isAtBottom,
        setScrollDirection,
        setAtBottom,
        shouldShowTabBar,
      }}
    >
      {children}
    </ScrollContext.Provider>
  );
};

export const useScrollContext = (): ScrollContextType => {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScrollContext must be used within ScrollProvider');
  }
  return context;
};

