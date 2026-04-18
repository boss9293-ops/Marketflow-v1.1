import os
import logging
import requests
import pandas as pd
from typing import Optional, Dict, Any
from dotenv import load_dotenv

_UTILS_DIR  = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_UTILS_DIR)
_ROOT_DIR   = os.path.dirname(os.path.dirname(_BACKEND_DIR))
load_dotenv(os.path.join(_ROOT_DIR, "marketflow", ".env"))
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

logger = logging.getLogger(__name__)

class FREDClient:
    BASE_URL = "https://api.stlouisfed.org/fred/"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FRED_API_KEY")
        if not self.api_key:
            raise ValueError("FRED_API_KEY not found in environment or provided.")

    def get_series(self, series_id: str, start_date: str, end_date: str) -> pd.DataFrame:
        """
        Fetches historical data for a given series_id.
        Returns a DataFrame with 'date' and 'value'.
        On HTTP error (e.g. 500 from FRED), logs a warning and returns empty DataFrame.
        """
        params = {
            "series_id": series_id,
            "api_key": self.api_key,
            "file_type": "json",
            "observation_start": start_date,
            "observation_end": end_date,
        }
        try:
            resp = requests.get(f"{self.BASE_URL}series/observations", params=params, timeout=30)
            resp.raise_for_status()
        except requests.exceptions.HTTPError as e:
            logger.warning("FRED API HTTP error for %s: %s — returning empty", series_id, e)
            return pd.DataFrame(columns=["date", "value"])
        except requests.exceptions.RequestException as e:
            logger.warning("FRED API request failed for %s: %s — returning empty", series_id, e)
            return pd.DataFrame(columns=["date", "value"])

        data = resp.json()

        observations = data.get("observations", [])
        df = pd.DataFrame(observations)
        if df.empty:
            return pd.DataFrame(columns=["date", "value"])

        df["date"] = pd.to_datetime(df["date"])
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
        return df[["date", "value"]].sort_values("date")

    def get_multiple_series(self, series_ids: Dict[str, str], start_date: str, end_date: str) -> pd.DataFrame:
        """
        series_ids: {InternalName: FredID} e.g. {"WALCL": "WALCL"}
        Returns a merged daily DataFrame. Individual series failures are skipped with a warning.
        """
        all_dfs = []
        for name, sid in series_ids.items():
            try:
                df = self.get_series(sid, start_date, end_date)
            except Exception as e:
                logger.warning("Skipping FRED series %s (%s): %s", name, sid, e)
                continue
            if df.empty:
                logger.warning("FRED series %s (%s) returned no data — skipping", name, sid)
                continue
            df = df.rename(columns={"value": name})
            df = df.set_index("date")
            all_dfs.append(df)

        if not all_dfs:
            return pd.DataFrame()

        # Merge all on date
        merged = pd.concat(all_dfs, axis=1)
        return merged
