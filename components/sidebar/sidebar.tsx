"use client";

import * as React from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { User } from '@supabase/supabase-js';

import { useSidebar } from "@/components/sidebar/sidebar-provider";
import { ThemeSwitcher } from "../theme-switcher";
import { SidebarToggle } from "../sidebar-toggle";
import LogoutButton from "../LogoutButton";
import { SIDEBAR } from "@/constant";

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
  userData?: User | null;
}

const title = "...";

export function Sidebar({ items, title, userData }: Props) {
  const { isOpen, isMobile, handleMobileNavigation } = useSidebar();
  
  // 기본적으로 펼칠 아이템 ID 생성
  const defaultExpandedItems = React.useMemo(() => {
    return items.map(item => item.id.toString());
  }, [items]);

  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-50 bg-background border-r transition-all duration-200 ease-in-out flex flex-col
        ${isOpen 
          ? isMobile 
            ? "translate-x-0 w-full" // 모바일에서 전체 화면 차지
            : `translate-x-0 ${SIDEBAR.CLASSES.DESKTOP_WIDTH}` // 태블릿/데스크탑에서 기본 너비
          : "-translate-x-full w-0"
        }
        md:relative md:${isOpen ? SIDEBAR.CLASSES.DESKTOP_WIDTH : "w-0 overflow-hidden"}
      `}
    >
      <div className="flex justify-between items-center p-4 border-b">
        {/* 사이드바가 열려 있을 때만 토글 버튼 표시 */}
        {isOpen && <SidebarToggle />}
        <h2 className="font-semibold">{title}</h2>
        <div className="flex items-center space-x-2">
          <ThemeSwitcher />
        </div>
      </div>

      <div className="flex-grow overflow-y-auto">
        <Accordion 
          type="multiple" 
          className="w-full" 
          defaultValue={defaultExpandedItems}
        >
          {items.map((item) => (
            <AccordionItem value={item.id.toString()} key={item.id}>
              <AccordionTrigger className="px-4">
                <div className="flex items-center">
                  {item.icon}
                  <span>{item.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="px-4 py-2 space-y-2">
                  {item.children?.map((child) => (
                    <li key={child.id} className="hover:text-primary transition-colors">
                      {child.href ? (
                        <Link 
                          href={`/study${child.href}`} 
                          className="block py-1"
                          onClick={handleMobileNavigation}
                        >
                          {child.title}
                        </Link>
                      ) : (
                        <span>{child.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* 사용자 정보 섹션 */}
      {userData && (
        <div className="mt-auto border-t p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {userData.user_metadata?.avatar_url && (
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <img 
                  src={userData.user_metadata.avatar_url} 
                  alt={userData.user_metadata.user_name || '사용자'} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-medium text-sm">
                {userData.user_metadata?.user_name || userData.user_metadata?.name || userData.email}
              </span>
              <span className="text-xs text-muted-foreground">
                {userData.email}
              </span>
            </div>
          </div>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}
