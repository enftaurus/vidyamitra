questions = {
    1: {
        "title": "Watermelon",
        "problem_statement": (
            "One hot summer day Pete and Billy decided to buy a watermelon. "
            "They chose the biggest and the ripest one. After that, the watermelon was weighed, "
            "and the scales showed w kilos.\n\n"
            "They are dying of thirst and want to divide the watermelon into two parts. "
            "Each of the two parts must weigh an even number of kilos. At the same time, "
            "the parts must be positive (greater than zero).\n\n"
            "Determine whether they can divide the watermelon in the way they want."
        ),
        "input_format": (
            "The first (and only) line contains an integer w (1 ≤ w ≤ 100) — "
            "the weight of the watermelon."
        ),
        "output_format": (
            "Print YES if they can divide the watermelon into two even positive parts. "
            "Otherwise, print NO."
        ),
        "sample_input": "8",
        "sample_output": "YES"
    },

    2: {
        "title": "Bit++",
        "problem_statement": (
            "The programming language Bit++ supports only one variable, called X. "
            "At the beginning, the value of X is 0.\n\n"
            "The language supports only two operations:\n"
            "1. ++X or X++ increases the value of X by 1.\n"
            "2. --X or X-- decreases the value of X by 1.\n\n"
            "You are given a list of operations. Perform all the operations and "
            "print the final value of X."
        ),
        "input_format": (
            "The first line contains a single integer n (1 ≤ n ≤ 150) — "
            "the number of operations.\n"
            "The next n lines contain one operation each."
        ),
        "output_format": "Print the final value of X.",
        "sample_input": "3\n++X\nX++\n--X",
        "sample_output": "1"
    },

    3: {
        "title": "Nearly Lucky Number",
        "problem_statement": (
            "Petya loves lucky numbers. We all know that lucky numbers are positive integers "
            "whose decimal representation contains only the digits 4 and 7.\n\n"
            "Petya calls a number nearly lucky if the number of lucky digits (4 and 7) "
            "in it is itself a lucky number.\n\n"
            "Given an integer n, determine whether it is nearly lucky."
        ),
        "input_format": (
            "The only line contains an integer n (1 ≤ n ≤ 10^18)."
        ),
        "output_format": (
            "Print YES if n is nearly lucky. Otherwise, print NO."
        ),
        "sample_input": "447474",
        "sample_output": "YES"
    },

    4: {
        "title": "Boy or Girl",
        "problem_statement": (
            "Those days, many boys use beautiful girls' photos as avatars in forums. "
            "So it is hard to tell the gender of a user at first glance.\n\n"
            "After entering a forum, the user typed a username. "
            "If the number of distinct characters in the username is even, "
            "then she is a girl; otherwise, he is a boy.\n\n"
            "Determine whether the user is a girl or a boy."
        ),
        "input_format": (
            "The first line contains a string username consisting of lowercase "
            "English letters (1 ≤ length ≤ 100)."
        ),
        "output_format": (
            "If the user is a girl, print 'CHAT WITH HER!'. "
            "Otherwise, print 'IGNORE HIM!'."
        ),
        "sample_input": "wjmzbmr",
        "sample_output": "CHAT WITH HER!"
    },

    5: {
        "title": "Stones on the Table",
        "problem_statement": (
            "There are n stones on the table in a row, each of them can be red, green, or blue. "
            "Count the minimum number of stones to remove so that no two neighboring stones "
            "have the same color.\n\n"
            "You are given the color sequence of the stones."
        ),
        "input_format": (
            "The first line contains integer n (1 ≤ n ≤ 50).\n"
            "The second line contains a string s of length n consisting of "
            "characters 'R', 'G', and 'B'."
        ),
        "output_format": (
            "Print a single integer — the minimum number of stones to remove."
        ),
        "sample_input": "3\nRRG",
        "sample_output": "1"
    }
}