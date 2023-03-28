---
layout: post
title: "📂 Go: Importig a CSV to PostgreSQL"
date: 2023-03-26 14:00:00 +0100
mood: happy
description: This post explains how to avoid high memory consumption when performing bulk imports using Go and PostgreSQL, providing step-by-step instructions for developers.
tags:
  - go
  - programming
  - gotchas
  - postgresql
---

<figure class="aligncenter">
    <img src="{{ "images/csv-rainbow.png" | absolute_url }}" alt="contents of a CSV file with each column in a different color" />
</figure>

If you are using Go ad PostgreSQL, and need to performa a bulk import a CSV,
it's most likely you will find the `COPY` protocol is the [feature](https://www.postgresql.org/docs/current/sql-copy.html){:target="\_blank"} that suits you better.
In that direction, you will find examples using [pgx](https://github.com/jackc/pgx) [CopyFrom](https://pkg.go.dev/github.com/jackc/pgx/v4#Conn.CopyFrom){:target="\_blank"} that relies on the native protocol, and it's fairly easy to use.
**However, depending how it's used you can have an exponencial increase of memory consumption of your application making it unreliable and more expensive to run.**

<!--more-->

> TL;DR;: **Don't** load the file in memory and use `pgx.CopyFromRows`. Instead, use the `io.Reader` of the file and implement a custom `pgx.CopyFromSource`.

[Checkout the repository with examples and details presented here](https://github.com/flavio1110/large-csv-to-pgsql){:target="\_blank"}.

### Context

Most of the examples out there, are either using [CopyFromRows](https://pkg.go.dev/github.com/jackc/pgx/v4#CopyFromRows){:target="\_blank"} or [CopyFromSlice](https://pkg.go.dev/github.com/jackc/pgx/v4#CopyFromSlice){:target="\_blank"}. However, the big problem is these two options require you to have the entire content in memory to use.
This is not a big deal when dealing with small files, there won't be concurrent usage, or you have infinite memory 😅.

### How big is the problem?

Comparing the memory consumption for the two distinct approaches importing a file with ~16MB (1M rows).

| Approach/metric  |     |  TotalAlloc |     |          Sys |
| ---------------- | --- | ----------: | --- | -----------: |
| Stream file      |     |      61 MiB |     |       12 Mib |
| Read entire file |     |      84 MiB |     |       58 Mib |
|                  |     | **+37.70%** |     | **+346.15%** |

**Yes,** you read it right! using `CopyFromRows` obtained +346.15% of memory from the OS! 58 MiB instead of 12 MiB.

_You can read more about the meaning of each metric on <https://golang.org/pkg/runtime/#MemStats> and find the source code and details of the comparisson on [this repository](https://github.com/flavio1110/large-csv-to-pgsql){:target="\_blank"}.._

### What's the most efficient way for using the COPY protocol with pgx?

Instead of reading the entire in memory, the idea is to stream each line of the file directly to PostgreSQL. In this way, we only need to keep the current line in-memory as opposed to the entire file.

#### How can we do it?

The [CopyFrom](https://github.com/jackc/pgx/blob/master/copy_from.go#LL238C21-L238C21){:target="\_blank"} method receives an implementation of the interface [CopyFromSource](https://github.com/jackc/pgx/blob/master/copy_from.go#L68){:target="\_blank"}.

Let's implement this interface using a CSV file with the followng three columns: first_name, last_name, and city.

```go
func newPeopleCopyFromSource(csvStream io.Reader) *peopleCopyFromSource {
   csvReader := csv.NewReader(csvStream)
   csvReader.ReuseRecord = true // reuse slice to return the record line by line
   csvReader.FieldsPerRecord = 3

   return &peopleCopyFromSource{
       reader: csvReader,
       isBOF:  true, // first line is header
       record: make([]interface{}, len(peopleColumns)),
   }
}

type peopleCopyFromSource struct {
   reader        *csv.Reader
   err           error
   currentCsvRow []string
   record        []interface{}
   isEOF         bool
   isBOF         bool
}

func (pfs *peopleCopyFromSource) Values() ([]any, error) {
   if pfs.isEOF {
       return nil, nil
   }

   if pfs.err != nil {
       return nil, pfs.err
   }

   // the order of the elements of the record array, must match with
   // the order of the columns in passed into the copy method
   pfs.record[0] = pfs.currentCsvRow[0]
   pfs.record[1] = pfs.currentCsvRow[1]
   pfs.record[2] = pfs.currentCsvRow[2]
   return pfs.record, nil
}

func (pfs *peopleCopyFromSource) Next() bool {
   pfs.currentCsvRow, pfs.err = pfs.reader.Read()
   if pfs.err != nil {

       // when get to the end of the file return false and clean the error.
       // If it's io.EOF we can't return an error
       if errors.Is(pfs.err, io.EOF) {
           pfs.isEOF = true
           pfs.err = nil
       }
       return false
   }

   if pfs.isBOF {
       pfs.isBOF = false
       return pfs.Next()
   }

   return true
}

func (pfs *peopleCopyFromSource) Err() error {
   return pfs.err
}
```

You can now use this implementation in the `CopyFrom` method. e.g.

```go
_, err := pgxConn.CopyFrom(ctx, pgx.Identifier{"people"}, peopleColumns, newPeopleCopyFromSource(csvStream))
```

### Conclusion

Using the `CopyFrom` with `CopyFromRows` or `CopyFrom` will significantly increase the memory comsultion of your application. The high memory usage can bring several problems like OOM errors, increase of costs, unavailability, etc.

By using a custom implementation of [CopyFromSource](https://github.com/jackc/pgx/blob/master/copy_from.go#L68){:target="\_blank"} will make your application much more efficient, reliable, and cheaper to ru.

You can find the entire source code of the examples above on [this repository](https://github.com/flavio1110/large-csv-to-pgsql){:target="\_blank"}. There you will also find more deatils about the comparisson and the not-so-great implementation.
