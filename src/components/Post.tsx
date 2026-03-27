"use client";

import { useEffect, useState } from "react";

export interface FilteredPost {
  post: {
    text: string;
    createdAt: string;
    uri: string;
    cid: string;
  };
  author: {
    did: string;
    handle: string;
    displayName: string;
    avatar: string;
  };
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5) return "now";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function Post({
  data,
  isNew,
}: {
  data: FilteredPost;
  isNew: boolean;
}) {
  const [animate, setAnimate] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  const { post, author } = data;
  const rkey = post.uri.split("/").pop();
  const postUrl = `https://bsky.app/profile/${author.handle}/post/${rkey}`;
  const profileUrl = `https://bsky.app/profile/${author.handle}`;

  return (
    <article
      className={`border-b border-gray-200 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a2734] cursor-pointer transition-colors ${
        animate ? "animate-slide-in" : ""
      }`}
      onClick={() => window.open(postUrl, "_blank")}
    >
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            window.open(profileUrl, "_blank");
          }}
        >
          {author.avatar ? (
            <img
              src={author.avatar}
              alt=""
              className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
              {(author.displayName || author.handle || "?")[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Author line */}
          <div className="flex items-baseline gap-1 leading-5">
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
              {author.displayName || author.handle}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
              @{author.handle}
            </span>
            <span className="text-gray-300 dark:text-gray-600 text-xs">
              ·
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {timeAgo(post.createdAt)}
            </span>
          </div>

          {/* Post text */}
          <p className="mt-0.5 text-[15px] leading-[1.4] text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
            {post.text}
          </p>

          {/* Action bar */}
          <div className="flex items-center gap-10 mt-2 -ml-1">
            <ActionButton
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                />
              }
              hoverColor="text-blue-500"
            />
            <ActionButton
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
                />
              }
              hoverColor="text-green-500"
            />
            <ActionButton
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              }
              hoverColor="text-red-500"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function ActionButton({
  icon,
  hoverColor,
}: {
  icon: React.ReactNode;
  hoverColor: string;
}) {
  return (
    <button
      className={`p-1.5 rounded-full text-gray-400 dark:text-gray-500 hover:${hoverColor} hover:bg-opacity-10 transition-colors`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        {icon}
      </svg>
    </button>
  );
}
