"use client";

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useSidebar } from "@/components/sidebar/sidebar-provider";
import { ThemeSwitcher } from "../theme-switcher";
import { SidebarToggle } from "../sidebar-toggle";
import LogoutButton from "../LogoutButton";

export interface SidebarItem {
  id: number;
  title: string;
  icon?: React.ReactNode;
  children?: {
    id: number;
    title: string;
    href?: string;
  }[];
}

interface Props {
  title?: string;
  items: SidebarItem[];
}

const title = "...";

export function Sidebar({ items, title }: Props) {
  const { isOpen } = useSidebar();
  
  // 화면 너비 상태 추적
  const [isMobile, setIsMobile] = React.useState(false);
  
  // 화면 크기 변경 감지
  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // 초기 체크
    checkIsMobile();
    
    // 리사이즈 이벤트 리스너
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-50 bg-background border-r transition-all duration-200 ease-in-out
        ${isOpen 
          ? isMobile 
            ? "translate-x-0 w-full" // 모바일에서 전체 화면 차지
            : "translate-x-0 w-64" // 태블릿/데스크탑에서 기본 너비
          : "-translate-x-full w-0"
        }
        md:relative md:${isOpen ? "w-64" : "w-0 overflow-hidden"}
      `}
    >
      <div className="flex justify-between items-center p-4 border-b">
        {/* 사이드바가 열려 있을 때만 토글 버튼 표시 */}
        {isOpen && <SidebarToggle />}
        <h2 className="font-semibold">{title}</h2>
        <div className="flex items-center space-x-2">
          <ThemeSwitcher />
          <LogoutButton />
        </div>
      </div>

      <Accordion type="multiple" className="w-full">
        {items.map((item) => (
          <AccordionItem value={item.id.toString()} key={item.id}>
            <AccordionTrigger className="px-4">
              <div className="flex items-center">
                {item.icon}
                <span>{item.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="px-4 py-2">
                {item.children?.map((child) => (
                  <li key={child.id}>
                    {child.title}
                    <br />
                    {child.href}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
