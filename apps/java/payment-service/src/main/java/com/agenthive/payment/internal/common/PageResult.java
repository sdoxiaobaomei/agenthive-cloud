package com.agenthive.payment.internal.common;

import lombok.Data;

import java.util.List;

@Data
public class PageResult<T> {
    private long current;
    private long size;
    private long total;
    private long pages;
    private List<T> records;

    public static <T> PageResult<T> of(long current, long size, long total, List<T> records) {
        PageResult<T> result = new PageResult<>();
        result.setCurrent(current);
        result.setSize(size);
        result.setTotal(total);
        result.setRecords(records);
        result.setPages((total + size - 1) / size);
        return result;
    }
}
