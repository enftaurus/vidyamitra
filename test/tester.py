from fastapi import FastAPI
app=FastAPI()
list=[]
@app.get("/display")
def display():
    dict={}
    for i in range(len(list)):
        dict[i]=list[i]
    return dict
@app.post("/add")
def add(item:int):
    list.append(item)
    return {"message":"item added successfully"}