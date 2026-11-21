/**
 * Multi-Factor Reverse-Auction Vendor Procurement Engine
 *
 * Automates competitive supplier bidding for technical event packages (Audio, Lighting, Trussing, Decor, DG Power):
 * - Partitions the Bill of Materials (BOM) into discrete trade packages.
 * - Manages time-boxed reverse auction bidding windows (e.g. 24 hours).
 * - Multi-Factor Algorithmic Bid Scoring:
 *     Score = 0.40 * PriceScore + 0.25 * VendorRating + 0.20 * ProximityScore + 0.15 * EquipmentAgeScore
 * - Recommends winning allocation and automatically binds payment milestone escrow terms.
 */

export interface AuctionPackageSpec {
  auctionId: string;
  workflowId: string;
  eventName: string;
  category: "sound_audio" | "lighting_visual" | "staging_trussing" | "power_generators" | "luxury_decor";
  itemCount: number;
  targetBudgetPaise: number;
  deliveryDeadlineIso: string;
  venueCoordinates?: { lat: number; lng: number };
  biddingOpensAtIso: string;
  biddingClosesAtIso: string;
  status: "open" | "evaluating" | "awarded" | "cancelled";
}

export interface VendorBid {
  bidId: string;
  auctionId: string;
  vendorId: string;
  vendorName: string;
  vendorRating: number; // 1.0 to 5.0
  distanceKm: number;
  equipmentAgeYears: number;
  bidAmountPaise: number;
  leadTimeHours: number;
  includesTechnicians: boolean;
  notes?: string;
  submittedAtIso: string;
}

export interface ScoredBid {
  bid: VendorBid;
  compositeScore: number; // 0 to 100
  priceScore: number;
  ratingScore: number;
  proximityScore: number;
  equipmentScore: number;
  rank: number;
  savingsVsBudgetPercent: number;
  isRecommended: boolean;
}

export interface AuctionEvaluationResult {
  auctionId: string;
  status: "awarded" | "no_bids" | "bids_evaluated";
  totalBidsReceived: number;
  winningBid?: ScoredBid;
  scoredBids: ScoredBid[];
  bestPricePaise: number;
  targetBudgetPaise: number;
  totalSavingsPaise: number;
  evaluationSummary: string;
}

export class ReverseAuctionService {
  /**
   * Scores and ranks all vendor bids for a trade package using multi-factor optimization.
   */
  public static evaluateBids(
    pkg: AuctionPackageSpec,
    bids: VendorBid[]
  ): AuctionEvaluationResult {
    if (!bids || bids.length === 0) {
      return {
        auctionId: pkg.auctionId,
        status: "no_bids",
        totalBidsReceived: 0,
        scoredBids: [],
        bestPricePaise: 0,
        targetBudgetPaise: pkg.targetBudgetPaise,
        totalSavingsPaise: 0,
        evaluationSummary: "No bids received for this auction package.",
      };
    }

    // Find minimum price among bids
    const minBidPaise = Math.min(...bids.map((b) => b.bidAmountPaise));

    const scored: ScoredBid[] = bids.map((bid) => {
      // 1. Price Score (40% weight): Lower price relative to min price scores higher
      const priceDeltaRatio = (bid.bidAmountPaise - minBidPaise) / minBidPaise;
      const priceScore = Math.max(0, Math.min(100, Math.round((1 - priceDeltaRatio * 0.8) * 100)));

      // 2. Vendor Quality Rating Score (25% weight): Based on historical client ratings
      const ratingScore = Math.max(0, Math.min(100, Math.round((bid.vendorRating / 5.0) * 100)));

      // 3. Proximity / Logistics Score (20% weight): Closer vendors have lower transit delay risk
      const proximityScore = Math.max(0, Math.min(100, Math.round(100 - bid.distanceKm * 2.0)));

      // 4. Equipment Reliability / Age Score (15% weight): Newer equipment (< 3 yrs) has lower failure rate
      const equipmentScore = Math.max(20, Math.min(100, Math.round(100 - bid.equipmentAgeYears * 15)));

      // Composite Weighted Score
      const compositeScore = Math.round(
        0.40 * priceScore +
        0.25 * ratingScore +
        0.20 * proximityScore +
        0.15 * equipmentScore
      );

      const savingsVsBudgetPercent = Math.round(
        ((pkg.targetBudgetPaise - bid.bidAmountPaise) / pkg.targetBudgetPaise) * 1000
      ) / 10;

      return {
        bid,
        compositeScore,
        priceScore,
        ratingScore,
        proximityScore,
        equipmentScore,
        rank: 0,
        savingsVsBudgetPercent,
        isRecommended: false,
      };
    });

    // Rank bids descending by compositeScore
    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    // Assign 1-based ranks
    scored.forEach((item, index) => {
      item.rank = index + 1;
      item.isRecommended = index === 0;
    });

    const winningBid = scored[0];
    const totalSavingsPaise = Math.max(0, pkg.targetBudgetPaise - winningBid.bid.bidAmountPaise);

    const summary =
      `Recommended Supplier: ${winningBid.bid.vendorName} (Rank #1 with Composite Score ${winningBid.compositeScore}/100). ` +
      `Bid: ₹${(winningBid.bid.bidAmountPaise / 100).toLocaleString("en-IN")}, saving ${winningBid.savingsVsBudgetPercent}% vs target budget. ` +
      `Rating: ${winningBid.bid.vendorRating}/5.0, Distance: ${winningBid.bid.distanceKm} km, Gear Age: ${winningBid.bid.equipmentAgeYears} yr.`;

    return {
      auctionId: pkg.auctionId,
      status: "awarded",
      totalBidsReceived: bids.length,
      winningBid,
      scoredBids: scored,
      bestPricePaise: winningBid.bid.bidAmountPaise,
      targetBudgetPaise: pkg.targetBudgetPaise,
      totalSavingsPaise,
      evaluationSummary: summary,
    };
  }
}
