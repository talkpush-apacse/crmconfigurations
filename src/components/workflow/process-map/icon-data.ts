/**
 * Icon shapes for the Process Map badges (from the lucide icon set, ISC licence), kept as plain data so the
 * diagram can be drawn anywhere, including on the server, without a React icon runtime.
 */
export type IconNode = [string, Record<string, string>][];

export const BADGE_ICONS: Record<string, IconNode> = {
  "Users": [
    [
      "path",
      {
        "d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
      }
    ],
    [
      "path",
      {
        "d": "M16 3.128a4 4 0 0 1 0 7.744"
      }
    ],
    [
      "path",
      {
        "d": "M22 21v-2a4 4 0 0 0-3-3.87"
      }
    ],
    [
      "circle",
      {
        "cx": "9",
        "cy": "7",
        "r": "4"
      }
    ]
  ],
  "FolderInput": [
    [
      "path",
      {
        "d": "M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"
      }
    ],
    [
      "path",
      {
        "d": "M2 13h10"
      }
    ],
    [
      "path",
      {
        "d": "m9 16 3-3-3-3"
      }
    ]
  ],
  "Phone": [
    [
      "path",
      {
        "d": "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"
      }
    ]
  ],
  "Bot": [
    [
      "path",
      {
        "d": "M12 8V4H8"
      }
    ],
    [
      "rect",
      {
        "width": "16",
        "height": "12",
        "x": "4",
        "y": "8",
        "rx": "2"
      }
    ],
    [
      "path",
      {
        "d": "M2 14h2"
      }
    ],
    [
      "path",
      {
        "d": "M20 14h2"
      }
    ],
    [
      "path",
      {
        "d": "M15 13v2"
      }
    ],
    [
      "path",
      {
        "d": "M9 13v2"
      }
    ]
  ],
  "MessageSquare": [
    [
      "path",
      {
        "d": "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"
      }
    ]
  ],
  "Cog": [
    [
      "path",
      {
        "d": "M11 10.27 7 3.34"
      }
    ],
    [
      "path",
      {
        "d": "m11 13.73-4 6.93"
      }
    ],
    [
      "path",
      {
        "d": "M12 22v-2"
      }
    ],
    [
      "path",
      {
        "d": "M12 2v2"
      }
    ],
    [
      "path",
      {
        "d": "M14 12h8"
      }
    ],
    [
      "path",
      {
        "d": "m17 20.66-1-1.73"
      }
    ],
    [
      "path",
      {
        "d": "m17 3.34-1 1.73"
      }
    ],
    [
      "path",
      {
        "d": "M2 12h2"
      }
    ],
    [
      "path",
      {
        "d": "m20.66 17-1.73-1"
      }
    ],
    [
      "path",
      {
        "d": "m20.66 7-1.73 1"
      }
    ],
    [
      "path",
      {
        "d": "m3.34 17 1.73-1"
      }
    ],
    [
      "path",
      {
        "d": "m3.34 7 1.73 1"
      }
    ],
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "2"
      }
    ],
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "8"
      }
    ]
  ],
  "Tag": [
    [
      "path",
      {
        "d": "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
      }
    ],
    [
      "circle",
      {
        "cx": "7.5",
        "cy": "7.5",
        "r": ".5",
        "fill": "currentColor"
      }
    ]
  ],
  "Search": [
    [
      "path",
      {
        "d": "m21 21-4.34-4.34"
      }
    ],
    [
      "circle",
      {
        "cx": "11",
        "cy": "11",
        "r": "8"
      }
    ]
  ],
  "Download": [
    [
      "path",
      {
        "d": "M12 15V3"
      }
    ],
    [
      "path",
      {
        "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      }
    ],
    [
      "path",
      {
        "d": "m7 10 5 5 5-5"
      }
    ]
  ],
  "ArrowLeftRight": [
    [
      "path",
      {
        "d": "M8 3 4 7l4 4"
      }
    ],
    [
      "path",
      {
        "d": "M4 7h16"
      }
    ],
    [
      "path",
      {
        "d": "m16 21 4-4-4-4"
      }
    ],
    [
      "path",
      {
        "d": "M20 17H4"
      }
    ]
  ],
  "Table": [
    [
      "path",
      {
        "d": "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"
      }
    ]
  ],
  "Share2": [
    [
      "circle",
      {
        "cx": "18",
        "cy": "5",
        "r": "3"
      }
    ],
    [
      "circle",
      {
        "cx": "6",
        "cy": "12",
        "r": "3"
      }
    ],
    [
      "circle",
      {
        "cx": "18",
        "cy": "19",
        "r": "3"
      }
    ],
    [
      "line",
      {
        "x1": "8.59",
        "x2": "15.42",
        "y1": "13.51",
        "y2": "17.49"
      }
    ],
    [
      "line",
      {
        "x1": "15.41",
        "x2": "8.59",
        "y1": "6.51",
        "y2": "10.49"
      }
    ]
  ],
  "Clock": [
    [
      "path",
      {
        "d": "M12 6v6l4 2"
      }
    ],
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "10"
      }
    ]
  ]
};
