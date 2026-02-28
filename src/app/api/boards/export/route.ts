import { NextResponse } from "next/server";
import { readBoards } from "@/lib/boards-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const boards = readBoards();
  const json = JSON.stringify(boards, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="boards-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
