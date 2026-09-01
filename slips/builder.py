from domain.slips.slip import BetSlip, SlipSelection

def build_slip(selections: list[SlipSelection], booking_code: str | None = None) -> BetSlip:
    slip = BetSlip(selections=selections)
    # frozen-safe: compute total_odds via model_copy
    updates: dict = {"total_odds": slip.compute_total_odds()}
    if booking_code:
        updates["booking_code"] = booking_code.strip()  # external reference only, never invented
    # if any updates, return copy
    if updates:
        slip = slip.model_copy(update=updates)
    return slip
