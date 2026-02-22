import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { aggregateCostsFromSessions } from '@/lib/cost-aggregate';

const DEFAULT_BUDGET = 100.0; // Default budget in USD

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";

  // Parse timeframe to days
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;

  try {
    const aggregated = await aggregateCostsFromSessions({ days });

    return NextResponse.json({
      ...aggregated,
      budget: DEFAULT_BUDGET,
    });
  } catch (error) {
    console.error('Error fetching cost data:', error);
    return NextResponse.json({ error: 'Failed to fetch cost data' }, { status: 500 });
  }
}

// POST endpoint to update budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { budget, alerts } = body;

    // In production, save to database
    // For now, just return success
    
    return NextResponse.json({
      success: true,
      budget,
      alerts,
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    );
  }
}
