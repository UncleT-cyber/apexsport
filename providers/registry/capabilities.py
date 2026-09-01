from providers.base.provider import ProviderCapability  # re-export

CAPABILITY_MATRIX = {
    "sportmonks": [ProviderCapability.FIXTURES, ProviderCapability.LIVESCORE, ProviderCapability.STATISTICS, ProviderCapability.ODDS],
    "api_football": [ProviderCapability.FIXTURES, ProviderCapability.STATISTICS, ProviderCapability.LINEUPS, ProviderCapability.INJURIES],
    "sportradar": [ProviderCapability.FIXTURES, ProviderCapability.ODDS, ProviderCapability.STATISTICS],
    "the_odds_api": [ProviderCapability.ODDS],
}
