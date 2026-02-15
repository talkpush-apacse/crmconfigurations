"use client";

import {
  Mail,
  Smartphone,
  MessagesSquare,
  MessageCircle,
  PhoneCall,
  Bot,
} from "lucide-react";
import type { CommunicationChannels } from "@/lib/types";

const channelConfig = [
  { key: "email" as const, label: "Email", icon: Mail, alwaysOn: true },
  { key: "sms" as const, label: "SMS", icon: Smartphone, alwaysOn: false },
  { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle, alwaysOn: false },
  { key: "messenger" as const, label: "Messenger", icon: MessagesSquare, alwaysOn: false },
  { key: "liveCall" as const, label: "Live Call", icon: PhoneCall, alwaysOn: false },
  { key: "aiCalls" as const, label: "AI Calls", icon: Bot, alwaysOn: false },
];

interface ChannelSelectorProps {
  channels: CommunicationChannels;
  onChange: (channels: CommunicationChannels) => void;
}

export function ChannelSelector({ channels, onChange }: ChannelSelectorProps) {
  const toggleChannel = (key: keyof CommunicationChannels) => {
    onChange({ ...channels, [key]: !channels[key] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Communication Channels</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {channelConfig.map((ch) => {
          const Icon = ch.icon;
          const isChecked = channels[ch.key];

          if (ch.alwaysOn) {
            return (
              <label
                key={ch.key}
                className="flex cursor-not-allowed items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm opacity-60"
              >
                <input type="checkbox" checked disabled className="h-4 w-4" />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{ch.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">Always on</span>
              </label>
            );
          }

          return (
            <label
              key={ch.key}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                isChecked
                  ? "border-primary/50 bg-primary/5"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleChannel(ch.key)}
                className="h-4 w-4"
              />
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{ch.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
