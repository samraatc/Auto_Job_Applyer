"""
Pagination helpers shared across repository functions.
"""
from typing import TypeVar, List, Tuple

T = TypeVar("T")


def paginate(items: List[T], page: int, page_size: int) -> Tuple[List[T], int]:
    """
    Slice a list for a given page. Returns (page_items, total_count).
    Pages are 1-indexed.
    """
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return items[start:end], total
