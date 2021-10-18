const { request, gql } = require("graphql-request");
const sdk = require("@defillama/sdk");
const { toUSDTBalances } = require("./helper/balances");

const graphEndpoint =
  "https://api.studio.thegraph.com/query/1712/alium-exchange-bsc/0.0.4";
const currentQuery = gql`
  query aliumFactories {
    aliumFactories(first: 1) {
      totalTransactions
      totalVolumeUSD
      totalLiquidityUSD
      __typename
    }
  }
`;
const historicalQuery = gql`
  query aliumDayDatas {
    aliumDayDatas(first: 1000, orderBy: date, orderDirection: asc) {
      date
      dailyVolumeUSD
      totalLiquidityUSD
      __typename
    }
  }
`;

async function tvl(timestamp, ethBlock, chainBlocks) {
  if (Math.abs(timestamp - Date.now() / 1000) < 3600) {
    const tvl = await request(graphEndpoint, currentQuery);
    return toUSDTBalances(tvl.aliumFactories[0].totalLiquidityUSD);
  } else {
    const tvl = (await request(graphEndpoint, historicalQuery)).aliumDayDatas;
    let closest = tvl[0];
    tvl.forEach((dayTvl) => {
      if (
        Math.abs(dayTvl.date - timestamp) < Math.abs(closest.date - timestamp)
      ) {
        closest = dayTvl;
      }
    });
    return toUSDTBalances(closest.totalLiquidityUSD);
  }
}

const almToken = "0x7C38870e93A1f959cB6c533eB10bBc3e438AaC11";
const masterChef = "0x2ff14D02002C1eD2b1fBf8987D1f7B1d9904a922";
async function staking(timestamp, ethBlock, chainBlocks) {
  const balances = {};
  const stakedAlm = sdk.api.erc20.balanceOf({
    target: almToken,
    owner: masterChef,
    chain: "bsc",
    block: chainBlocks.bsc,
  });

  sdk.util.sumSingleBalance(
    balances,
    "bsc:" + almToken,
    (await stakedAlm).output
  );
  return balances;
}

module.exports = {
  misrepresentedTokens: true,
  methodology:
    "TVL accounts for the liquidity on all AMM pools, using the TVL chart on alium.info as the source. Staking accounts for the ALM locked in MasterChef (0x2ff14D02002C1eD2b1fBf8987D1f7B1d9904a922)",
  staking: {
    tvl: staking,
  },
  tvl,
};
