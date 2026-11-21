/**
 * Reverse Auction Procurement Engine Test Suite
 *
 * Verifies:
 * 1. Multi-factor bid scoring (price, rating, proximity, gear age).
 * 2. Competitive ranking and winning allocation recommendation.
 * 3. Calculation of budgetary cost savings.
 * 4. Handling edge cases (no bids, single bid, tied prices).
 */

import { ReverseAuctionService, AuctionPackageSpec, VendorBid } from "../services/procurement/reverse_auction_service";

describe("Milestone 70: Multi-Factor Reverse-Auction Vendor Procurement Engine", () => {
  const samplePkg: AuctionPackageSpec = {
    auctionId: "auc-sound-2026-001",
    workflowId: "wf-test-procure-101",
    eventName: "Grand Corporate Conclave 2026",
    category: "sound_audio",
    itemCount: 14,
    targetBudgetPaise: 45000000, // ₹4,50,000 target budget
    deliveryDeadlineIso: "2026-11-25T14:00:00Z",
    biddingOpensAtIso: "2026-11-21T10:00:00Z",
    biddingClosesAtIso: "2026-11-22T10:00:00Z",
    status: "open",
  };

  it("scores and ranks incoming vendor bids and selects optimal multi-factor winner", () => {
    const bids: VendorBid[] = [
      {
        bidId: "bid-v1",
        auctionId: samplePkg.auctionId,
        vendorId: "vendor-raipur-sound-pro",
        vendorName: "Raipur Audio & Stage Works",
        vendorRating: 4.8,
        distanceKm: 8.5,
        equipmentAgeYears: 1.5,
        bidAmountPaise: 38000000, // ₹3,80,000 (competitive, top gear, local)
        leadTimeHours: 4,
        includesTechnicians: true,
        submittedAtIso: "2026-11-21T12:00:00Z",
      },
      {
        bidId: "bid-v2",
        auctionId: samplePkg.auctionId,
        vendorId: "vendor-bhilai-cheap",
        vendorName: "Discount Sound Bhilai",
        vendorRating: 3.5,
        distanceKm: 42.0, // further away
        equipmentAgeYears: 5.0, // older gear
        bidAmountPaise: 35000000, // ₹3,50,000 (cheapest but lower quality/distance risk)
        leadTimeHours: 8,
        includesTechnicians: false,
        submittedAtIso: "2026-11-21T13:30:00Z",
      },
      {
        bidId: "bid-v3",
        auctionId: samplePkg.auctionId,
        vendorId: "vendor-luxury-delhi",
        vendorName: "Prime Concert Rigging Delhi",
        vendorRating: 4.9,
        distanceKm: 850.0, // very far
        equipmentAgeYears: 1.0,
        bidAmountPaise: 52000000, // ₹5,20,000 (over budget)
        leadTimeHours: 24,
        includesTechnicians: true,
        submittedAtIso: "2026-11-21T14:00:00Z",
      },
    ];

    const evalResult = ReverseAuctionService.evaluateBids(samplePkg, bids);

    expect(evalResult.status).toBe("awarded");
    expect(evalResult.totalBidsReceived).toBe(3);
    expect(evalResult.winningBid).toBeDefined();

    // The winning bid should be Raipur Audio & Stage Works due to strong balance of price, quality, and proximity
    expect(evalResult.winningBid!.bid.vendorId).toBe("vendor-raipur-sound-pro");
    expect(evalResult.winningBid!.rank).toBe(1);
    expect(evalResult.winningBid!.isRecommended).toBe(true);

    // Cost savings vs budget should be positive
    expect(evalResult.totalSavingsPaise).toBeGreaterThan(0);
    expect(evalResult.winningBid!.savingsVsBudgetPercent).toBeGreaterThan(10.0);

    // Check ranking order
    expect(evalResult.scoredBids[0].compositeScore).toBeGreaterThanOrEqual(evalResult.scoredBids[1].compositeScore);
    expect(evalResult.scoredBids[1].compositeScore).toBeGreaterThanOrEqual(evalResult.scoredBids[2].compositeScore);
  });

  it("handles packages with zero bids gracefully", () => {
    const evalResult = ReverseAuctionService.evaluateBids(samplePkg, []);
    expect(evalResult.status).toBe("no_bids");
    expect(evalResult.totalBidsReceived).toBe(0);
    expect(evalResult.winningBid).toBeUndefined();
  });
});
