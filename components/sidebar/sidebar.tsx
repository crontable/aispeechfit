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

  // 768px 미만에서는 overlay 형태, 그 이상에서는 고정형태로 레이아웃에 영향을 줌
  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-50 bg-background border-r transition-all duration-200 ease-in-out
        ${isOpen ? "translate-x-0 w-64" : "-translate-x-full w-0"}
        md:relative md:${isOpen ? "w-64" : "w-0 overflow-hidden"}
      `}
    >
      <div className="flex justify-between items-center p-4 border-b">
        <SidebarToggle />
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
