#include <stdio.h>
int main(void)
{
    // 转义序列 （\a | \007） 电脑警报，好像不起作用？
    // printf("hello!\007\n");
    // printf("hello!\a\n");

    // printf("%d",sizeof(int));
    // printf("%d",sizeof(double));

    // float a, b;
    // b = 2.0e20 + 1.0;
    // a = b - 2.0e20;
    // printf("%f \n", a);

    float a = 123.456;
    printf("%10.1f \n",a);
    
    return 0;
}