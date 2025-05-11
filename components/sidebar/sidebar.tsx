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
  const { isOpen, toggleSidebar } = useSidebar();

  return (
    <div
      className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out
      ${isOpen ? "translate-x-0" : "-translate-x-full"}
      md:relative md:translate-x-0
    `}
    >
      <div className="flex justify-between items-center p-4 border-b">
        <SidebarToggle />
        <h2 className="font-semibold">{title}</h2>
      <ThemeSwitcher />
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
