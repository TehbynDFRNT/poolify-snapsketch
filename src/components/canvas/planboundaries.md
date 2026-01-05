Got it. You want a parameterized **T‑edge** shape that converts cleanly into the same “node points” JSON your rectangles use, plus the exact node list for **Amalfi 9 × 3 m**.

Below is the **schema**, the **geometry rule**, a **drop‑in converter**, and the **actual node list** for Amalfi.

---

## CSV schema for T‑edge pools

```text
name,length,width,left_top_side_width,t_edge_internal_width,t_edge_internal_height,notes
```

* `length` = overall X (mm)
* `width`  = overall Y (mm)
* `left_top_side_width` = distance from the left corner to the start of the T opening (mm)
* `t_edge_internal_width` = width of the opening (mm)
* `t_edge_internal_height` = depth of the opening measured downward from the top edge (mm)

**Validity constraints**

* `0 < left_top_side_width`
* `left_top_side_width + t_edge_internal_width < length`
* `0 < t_edge_internal_height < width`

---

## Node ordering (clockwise, y increases downward)

For a T‑opening on the **top** edge:

```
P0 = (0, 0)
P1 = (LTSW, 0)
P2 = (LTSW, TEH)
P3 = (LTSW + TEW, TEH)
P4 = (LTSW + TEW, 0)
P5 = (L, 0)
P6 = (L, W)
P7 = (0, W)
P8 = (0, 0)   // close
```

Where:

* `LTSW = left_top_side_width`
* `TEW = t_edge_internal_width`
* `TEH = t_edge_internal_height`
* `L = length`
* `W = width`

This yields **8 edges** (n=8, e=8). If you want to tag edges for your coping precedence:

* `T_EDGE`: P1→P2, P2→P3, P3→P4
* `STANDARD`: all others

---

## Drop‑in converter (TypeScript)

```ts
type Pt = { x: number; y: number };

export function tEdgeRowToNodes(params: {
  name: string;
  length: number;  // L
  width: number;   // W
  left_top_side_width: number;        // LTSW
  t_edge_internal_width: number;      // TEW
  t_edge_internal_height: number;     // TEH
  notes?: string;
}) {
  const { length: L, width: W, left_top_side_width: LTSW,
          t_edge_internal_width: TEW, t_edge_internal_height: TEH } = params;

  if (!(LTSW > 0 && LTSW + TEW < L))
    throw new Error('Invalid T opening: left_top_side_width + t_edge_internal_width must be < length, and left_top_side_width > 0');
  if (!(TEH > 0 && TEH < W))
    throw new Error('Invalid T height: must be > 0 and < width');

  const nodes: Pt[] = [
    { x: 0,     y: 0 },
    { x: LTSW,  y: 0 },
    { x: LTSW,  y: TEH },
    { x: LTSW + TEW, y: TEH },
    { x: LTSW + TEW, y: 0 },
    { x: L,     y: 0 },
    { x: L,     y: W },
    { x: 0,     y: W },
    { x: 0,     y: 0 },   // closed loop as in your existing rows
  ];

  // Keep your left/right “anchor” convention (150 mm from ends at mid-height)
  const leftAnchor  = { x: 150,  y: Math.round(W / 2) };
  const rightAnchor = { x: L-150, y: Math.round(W / 2) };

  // Optional edge tags for coping precedence (if you store them)
  const edgeTags = [
    { from: 0, to: 1, tag: 'STANDARD' },
    { from: 1, to: 2, tag: 'T_EDGE' },
    { from: 2, to: 3, tag: 'T_EDGE' },
    { from: 3, to: 4, tag: 'T_EDGE' },
    { from: 4, to: 5, tag: 'STANDARD' },
    { from: 5, to: 6, tag: 'STANDARD' },
    { from: 6, to: 7, tag: 'STANDARD' },
    { from: 7, to: 0, tag: 'STANDARD' },
  ];

  return { nodes, leftAnchor, rightAnchor, edgeTags };
}
```

---

## Amalfi 9 × 3 m — computed node points

**Input**
`length = 9000`
`width = 3000`
`left_top_side_width = 2200`
`t_edge_internal_width = 4600`
`t_edge_internal_height = 600`

**Resulting nodes (clockwise, closed):**

```json
[
  {"x":0,"y":0},
  {"x":2200,"y":0},
  {"x":2200,"y":600},
  {"x":6800,"y":600},
  {"x":6800,"y":0},
  {"x":9000,"y":0},
  {"x":9000,"y":3000},
  {"x":0,"y":3000},
  {"x":0,"y":0}
]
```

**Anchors (same convention as rectangles):**

```json
{"x":150,"y":1500}  // leftAnchor
{"x":8850,"y":1500} // rightAnchor
```

---

## If you also need a DB row like your rectangles

Here’s a single line (swap in your own UUIDs/timestamps):

```
b8c3d7b2-4c2d-4e39-9c7d-4ff3a9fd1f5a	Amalfi 9 × 3m	[{"x":0,"y":0},{"x":2200,"y":0},{"x":2200,"y":600},{"x":6800,"y":600},{"x":6800,"y":0},{"x":9000,"y":0},{"x":9000,"y":3000},{"x":0,"y":3000},{"x":0,"y":0}]	{"x":150,"y":1500}	{"x":8850,"y":1500}	[{"from":1,"to":2,"tag":"T_EDGE"},{"from":2,"to":3,"tag":"T_EDGE"},{"from":3,"to":4,"tag":"T_EDGE"}]	draft			Contemporary		2025-11-13 00:00:00+00	2025-11-13 00:00:00+00	1aad4757-d80b-44e5-971b-3f26fbade40a
```

* The `edgeTags` array is optional; include it if you want the coping planner to know which segments are `T_EDGE`.
* Everything else follows your existing rectangular rows: same anchor logic, same closed polygon format.

If you want this generalized for **asymmetric** T openings (different left/right top widths), add a `right_top_side_width` column and set `P4.x = L - RTSW` and ensure `LTSW + TEW + RTSW = L`.
