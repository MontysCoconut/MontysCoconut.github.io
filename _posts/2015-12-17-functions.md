---
layout: post
title: Functions
categories: [general, demo, sample]
tags: [demo]
description: This post shows how Monty functions work.
---

### Functions

In Monty functions are regular objects, just like integers or lists.
This means that they can be assigned to variables, passed as arguments to other
functions and also be return values. Using a function's name will not call the
function, but return the function object. Functions are called using
parenthesis. 

<pre class="cm-s-default">
Int gcd(Int a, Int b):
    while b != 0:
        Int tmp_a := a
        Int tmp_b := b
        a := tmp_b
        b := tmp_a % tmp_b
    return a
 
((Int, Int) -> Int) gcd2 := gcd
 
Int number  := gcd(42, 56)
Int number2 := gcd2(42, 56)
</pre>

The above function calculates the greatest common divisor. The variable
``gcd2`` is assigned the function object. It can be called just like the
original function.